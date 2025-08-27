import { createClient } from '@supabase/supabase-js';

// واجهات TypeScript
export interface WhatsAppNotification {
  id: string;
  recipient_id: string;
  post_id?: string;
  message_content: string;
  message_type: 'new_post' | 'price_update' | 'strategy_update';
  whatsapp_message_id?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  template_name: string;
  template_type: string;
  language_code: string;
  subject: string;
  body_template: string;
  is_active: boolean;
}

export interface FollowerForNotification {
  follower_id: string;
  whatsapp_number: string;
  username: string;
  full_name: string;
  notification_preferences: {
    new_posts: boolean;
    price_updates: boolean;
    strategy_updates: boolean;
  };
}

export interface PostData {
  id: string;
  user_id: string;
  content: string;
  symbol: string;
  company_name: string;
  current_price: number;
  target_price: number;
  stop_loss_price: number;
  strategy: string;
  author_name: string;
}

// خدمة WhatsApp
export class WhatsAppService {
  private supabase;
  private whatsappApiUrl: string;
  private whatsappApiToken: string;

  constructor() {
    // إعداد Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);

    // إعداد WhatsApp API - يدعم Meta و Twilio
    this.whatsappApiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.whatsappApiToken = process.env.WHATSAPP_API_TOKEN || '';
  }

  /**
   * إرسال إشعارات واتساب للمتابعين عند نشر منشور جديد
   */
  async notifyFollowersOfNewPost(postData: PostData): Promise<boolean> {
    try {
      console.log('[WhatsApp Service] Sending notifications for new post:', postData.id);

      // الحصول على المتابعين المؤهلين للإشعارات
      const followers = await this.getFollowersForNotifications(postData.user_id);
      
      if (followers.length === 0) {
        console.log('[WhatsApp Service] No followers found for notifications');
        return true;
      }

      // الحصول على قالب الرسالة
      const template = await this.getMessageTemplate('new_post', 'ar');
      if (!template) {
        console.error('[WhatsApp Service] No message template found');
        return false;
      }

      // إرسال الرسائل للمتابعين
      const notificationPromises = followers.map(follower => 
        this.sendNewPostNotification(follower, postData, template)
      );

      const results = await Promise.allSettled(notificationPromises);
      const successCount = results.filter(result => result.status === 'fulfilled').length;
      
      console.log(`[WhatsApp Service] Sent ${successCount}/${followers.length} notifications successfully`);
      return successCount > 0;

    } catch (error) {
      console.error('[WhatsApp Service] Error in notifyFollowersOfNewPost:', error);
      return false;
    }
  }

  /**
   * الحصول على المتابعين المؤهلين للإشعارات
   */
  private async getFollowersForNotifications(authorUserId: string): Promise<FollowerForNotification[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_followers_for_whatsapp_notifications', {
        author_user_id: authorUserId
      });

      if (error) {
        console.error('[WhatsApp Service] Error getting followers:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[WhatsApp Service] Error in getFollowersForNotifications:', error);
      return [];
    }
  }

  /**
   * الحصول على قالب رسالة
   */
  private async getMessageTemplate(templateType: string, languageCode: string = 'ar'): Promise<WhatsAppTemplate | null> {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_message_templates')
        .select('*')
        .eq('template_type', templateType)
        .eq('language_code', languageCode)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('[WhatsApp Service] Error getting template:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[WhatsApp Service] Error in getMessageTemplate:', error);
      return null;
    }
  }

  /**
   * إرسال إشعار منشور جديد لمتابع واحد
   */
  private async sendNewPostNotification(
    follower: FollowerForNotification,
    postData: PostData,
    template: WhatsAppTemplate
  ): Promise<boolean> {
    try {
      // تخصيص الرسالة
      const message = this.personalizeMessage(template.body_template, {
        author_name: postData.author_name,
        symbol: postData.symbol,
        company_name: postData.company_name,
        current_price: postData.current_price.toString(),
        target_price: postData.target_price.toString(),
        stop_loss_price: postData.stop_loss_price.toString(),
        strategy: postData.strategy,
        content: postData.content,
        username: follower.username,
        full_name: follower.full_name
      });

      // حفظ سجل الإشعار في قاعدة البيانات
      const { data: notificationData, error: logError } = await this.supabase.rpc('log_whatsapp_notification', {
        p_recipient_id: follower.follower_id,
        p_post_id: postData.id,
        p_message_content: message,
        p_message_type: 'new_post',
        p_status: 'pending'
      });

      if (logError) {
        console.error('[WhatsApp Service] Error logging notification:', logError);
        return false;
      }

      const notificationId = notificationData;

      // إرسال الرسالة عبر WhatsApp API
      const whatsappResult = await this.sendWhatsAppMessage(follower.whatsapp_number, message);

      // تحديث حالة الإشعار
      if (whatsappResult.success) {
        await this.supabase.rpc('update_whatsapp_notification_status', {
          p_notification_id: notificationId,
          p_status: 'sent',
          p_whatsapp_message_id: whatsappResult.messageId
        });
        return true;
      } else {
        await this.supabase.rpc('update_whatsapp_notification_status', {
          p_notification_id: notificationId,
          p_status: 'failed',
          p_error_message: whatsappResult.error
        });
        return false;
      }

    } catch (error) {
      console.error('[WhatsApp Service] Error in sendNewPostNotification:', error);
      return false;
    }
  }

  /**
   * تخصيص الرسالة بالمتغيرات
   */
  private personalizeMessage(template: string, variables: Record<string, string>): string {
    let personalizedMessage = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      personalizedMessage = personalizedMessage.replace(new RegExp(placeholder, 'g'), value);
    });

    return personalizedMessage;
  }

  /**
   * إرسال رسالة واتساب (يدعم Meta WhatsApp Business API و Twilio)
   */
  private async sendWhatsAppMessage(phoneNumber: string, message: string): Promise<{success: boolean, messageId?: string, error?: string}> {
    try {
      if (!this.whatsappApiToken) {
        console.log('[WhatsApp Service] API token not configured, skipping actual send');
        return { success: true, messageId: 'test_' + Date.now() };
      }

      // تنسيق رقم الهاتف (إزالة الرموز والمسافات وإضافة +)
      let cleanPhoneNumber = phoneNumber.replace(/[^\d]/g, '');
      if (!cleanPhoneNumber.startsWith('966')) { // إضافة كود السعودية إذا لم يكن موجوداً
        cleanPhoneNumber = '966' + cleanPhoneNumber;
      }

      // تحديد نوع API المستخدم
      const apiProvider = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' أو 'twilio'

      if (apiProvider === 'twilio') {
        return await this.sendViaTwilio(cleanPhoneNumber, message);
      } else {
        return await this.sendViaMeta(cleanPhoneNumber, message);
      }

    } catch (error) {
      console.error('[WhatsApp Service] Error sending WhatsApp message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * إرسال رسالة عبر Meta WhatsApp Business API
   */
  private async sendViaMeta(phoneNumber: string, message: string): Promise<{success: boolean, messageId?: string, error?: string}> {
    try {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      
      if (!phoneNumberId) {
        return {
          success: false,
          error: 'WHATSAPP_PHONE_NUMBER_ID not configured'
        };
      }

      const requestData = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: {
          preview_url: false,
          body: message
        }
      };

      const response = await fetch(`${this.whatsappApiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.whatsappApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const responseData = await response.json();

      if (response.ok && responseData.messages) {
        return {
          success: true,
          messageId: responseData.messages[0].id
        };
      } else {
        console.error('[WhatsApp Service] Meta API Error:', responseData);
        return {
          success: false,
          error: responseData.error?.message || 'Meta API error'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Meta API error'
      };
    }
  }

  /**
   * إرسال رسالة عبر Twilio WhatsApp API
   */
  private async sendViaTwilio(phoneNumber: string, message: string): Promise<{success: boolean, messageId?: string, error?: string}> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = this.whatsappApiToken; // أو TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // مثل: whatsapp:+14155238886

      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          error: 'Twilio credentials not configured'
        };
      }

      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('From', fromNumber);
      formData.append('To', `whatsapp:+${phoneNumber}`);
      formData.append('Body', message);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData
      });

      const responseData = await response.json();

      if (response.ok && responseData.sid) {
        return {
          success: true,
          messageId: responseData.sid
        };
      } else {
        console.error('[WhatsApp Service] Twilio API Error:', responseData);
        return {
          success: false,
          error: responseData.message || 'Twilio API error'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Twilio API error'
      };
    }
  }

  /**
   * تحديث إعدادات إشعارات المستخدم
   */
  async updateUserNotificationSettings(
    userId: string, 
    whatsappNumber?: string, 
    notificationsEnabled?: boolean,
    preferences?: {
      new_posts?: boolean;
      price_updates?: boolean;
      strategy_updates?: boolean;
    }
  ): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (whatsappNumber !== undefined) {
        updateData.whatsapp_number = whatsappNumber;
      }
      
      if (notificationsEnabled !== undefined) {
        updateData.whatsapp_notifications_enabled = notificationsEnabled;
      }
      
      if (preferences) {
        // دمج الإعدادات الجديدة مع الموجودة
        const { data: currentUser } = await this.supabase
          .from('profiles')
          .select('notification_preferences')
          .eq('id', userId)
          .single();
          
        const currentPreferences = currentUser?.notification_preferences || {};
        updateData.notification_preferences = { ...currentPreferences, ...preferences };
      }

      const { error } = await this.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('[WhatsApp Service] Error updating user settings:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[WhatsApp Service] Error in updateUserNotificationSettings:', error);
      return false;
    }
  }

  /**
   * الحصول على إعدادات إشعارات المستخدم
   */
  async getUserNotificationSettings(userId: string) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('whatsapp_number, whatsapp_notifications_enabled, notification_preferences')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[WhatsApp Service] Error getting user settings:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[WhatsApp Service] Error in getUserNotificationSettings:', error);
      return null;
    }
  }

  /**
   * الحصول على إحصائيات الإشعارات
   */
  async getNotificationStats(userId?: string, dateFrom?: string, dateTo?: string) {
    try {
      let query = this.supabase
        .from('whatsapp_notifications')
        .select('status, message_type, created_at');

      if (userId) {
        query = query.eq('recipient_id', userId);
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[WhatsApp Service] Error getting stats:', error);
        return null;
      }

      // تجميع الإحصائيات
      const stats = {
        total: data.length,
        sent: data.filter(n => n.status === 'sent').length,
        failed: data.filter(n => n.status === 'failed').length,
        pending: data.filter(n => n.status === 'pending').length,
        byType: {
          new_post: data.filter(n => n.message_type === 'new_post').length,
          price_update: data.filter(n => n.message_type === 'price_update').length,
          strategy_update: data.filter(n => n.message_type === 'strategy_update').length,
        }
      };

      return stats;
    } catch (error) {
      console.error('[WhatsApp Service] Error in getNotificationStats:', error);
      return null;
    }
  }
}

// تصدير instance مفرد
export const whatsappService = new WhatsAppService();