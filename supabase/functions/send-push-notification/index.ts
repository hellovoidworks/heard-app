// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// @ts-ignore - Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
      .select('token')
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
    
    // Send push notifications to all tokens
    const messages = tokens.map(({ token }) => ({
      to: token,
      title,
      body,
      data: data || {},
      sound: 'default',
      badge: 1,
    }));
    
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    const result = await response.json();
    
    // Check if Expo returned any errors
    if (result.errors && result.errors.length > 0) {
      console.error('Expo Push API returned errors:', result.errors);
      return new Response(JSON.stringify({ success: false, errors: result.errors, data: result.data }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    return new Response(JSON.stringify({ success: true, result }), {
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
