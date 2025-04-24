import { supabase } from './supabase';

/**
 * Report type enum
 */
export enum ReportType {
  LETTER = 'letter',
  REPLY = 'reply'
}

/**
 * Report content for moderation
 * @param letterId ID of the letter being reported
 * @param reportType Type of report (letter or reply)
 * @param reason Optional reason for the report
 * @param otherParticipantId Optional ID of the other participant (for thread reports)
 * @returns Promise resolving to success status
 */
export const reportContent = async (
  letterId: string,
  reportType: ReportType,
  reason?: string,
  otherParticipantId?: string
): Promise<{ success: boolean; error: any }> => {
  try {
    console.log('Calling report_content RPC with params:', {
      p_content_type: reportType,
      p_letter_id: letterId,
      p_reason: reason,
      p_other_participant_id: otherParticipantId
    });
    
    const { data, error } = await supabase.rpc('report_content', {
      p_content_type: reportType,
      p_letter_id: letterId,
      p_reason: reason,
      p_other_participant_id: otherParticipantId
    });
    
    if (error) {
      console.error('RPC error:', error);
      throw error;
    }
    
    console.log('RPC response data:', data);
    return { success: !!data, error: null };
  } catch (error) {
    console.error(`Error reporting ${reportType}:`, error);
    return { success: false, error };
  }
};
