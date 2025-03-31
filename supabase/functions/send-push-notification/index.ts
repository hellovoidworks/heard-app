// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Expo Push Notification Service endpoint
const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  console.log('Received push notification request');
  
  try {
    // Log request headers for debugging
    const headers = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('Request headers:', headers);
    
    // Parse request body
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { userId, title, body, data } = requestBody;
    
    // Create a Supabase client with the Admin key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    console.log('Supabase URL available:', !!supabaseUrl);
    console.log('Supabase key available:', !!supabaseKey);
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey);
    
    // Get the user's push tokens
    const { data: tokens, error: tokenError } = await supabaseClient
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId);
    
    if (tokenError) {
      console.error('Error fetching tokens:', tokenError);
      return new Response(JSON.stringify({ error: tokenError.message }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    if (!tokens || tokens.length === 0) {
      console.log('No push tokens found for user:', userId);
      return new Response(JSON.stringify({ message: 'No push tokens found for user' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    
    console.log('Found tokens for user:', tokens.length);
    
    // Define the result type to avoid TypeScript errors
    type PushResult = {
      token: string;
      platform: string;
      status: string;
      message?: string;
      error?: string;
      details?: any;
      data?: any;
    };
    
    const results: PushResult[] = [];
    
    // Filter for Expo tokens only
    const expoTokens = tokens.filter(token => token.platform === 'expo');
    
    console.log(`Found ${expoTokens.length} Expo tokens`);
    
    // Send to Expo devices via Expo Push API
    if (expoTokens.length > 0) {
      console.log('Sending to Expo devices via Expo Push API...');
      
      const messages = expoTokens.map(({ token }) => ({
        to: token,
        title,
        body,
        data: data || {},
        sound: 'default',
        badge: 1,
        channelId: 'default', // Add Android channel ID
      }));
      
      try {
        console.log('Sending to Expo Push API with payload:', JSON.stringify(messages));
        
        const response = await fetch(EXPO_PUSH_API_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        
        console.log('Expo Push API response status:', response.status);
        console.log('Expo Push API response headers:', JSON.stringify(Object.fromEntries([...response.headers])));
        
        const responseText = await response.text();
        console.log('Expo Push API raw response:', responseText);
        
        let result;
        try {
          result = JSON.parse(responseText);
          console.log('Expo Push API parsed response:', result);
        } catch (parseError) {
          console.error('Error parsing Expo response:', parseError);
          result = { errors: [{ message: 'Failed to parse response' }] };
        }
        
        // Check if Expo returned any errors
        if (result.errors && result.errors.length > 0) {
          console.error('Expo Push API returned errors:', result.errors);
          
          // Add error results
          expoTokens.forEach(({ token }) => {
            results.push({
              token,
              platform: 'expo',
              status: 'error',
              error: 'Failed to send via Expo Push API',
              details: result.errors,
            });
          });
        } else {
          console.log('Expo push successful response:', result);
          
          // Add success results
          expoTokens.forEach(({ token }) => {
            results.push({
              token,
              platform: 'expo',
              status: 'sent',
              data: result.data,
            });
          });
        }
      } catch (error) {
        console.error('Error sending to Expo push service:', error);
        
        // Add error results
        expoTokens.forEach(({ token }) => {
          results.push({
            token,
            platform: 'expo',
            status: 'error',
            error: error.message,
          });
        });
      }
    }
    
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Exception in Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
