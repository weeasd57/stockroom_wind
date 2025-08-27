import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { MessageCircle, Bell, BellOff, Phone } from 'lucide-react';

const WhatsAppSettings = ({ user }) => {
  const [settings, setSettings] = useState({
    whatsapp_number: '',
    whatsapp_notifications_enabled: false,
    notification_preferences: {
      new_posts: true,
      price_updates: false,
      strategy_updates: false
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // تحميل الإعدادات الحالية
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/whatsapp/settings', {
        headers: {
          'Authorization': `Bearer ${user?.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings({
            whatsapp_number: data.data.whatsapp_number || '',
            whatsapp_notifications_enabled: data.data.whatsapp_notifications_enabled || false,
            notification_preferences: data.data.notification_preferences || {
              new_posts: true,
              price_updates: false,
              strategy_updates: false
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/whatsapp/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({
          whatsapp_number: settings.whatsapp_number,
          notifications_enabled: settings.whatsapp_notifications_enabled,
          notification_preferences: settings.notification_preferences
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('تم حفظ الإعدادات بنجاح! ✅');
        setSettings(prev => ({ ...prev, ...data.data }));
      } else {
        toast.error(data.error || 'حدث خطأ في حفظ الإعدادات');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('حدث خطأ في الاتصال');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!settings.whatsapp_number) {
      toast.error('يرجى إدخال رقم الواتساب أولاً');
      return;
    }

    if (!settings.whatsapp_notifications_enabled) {
      toast.error('يرجى تفعيل إشعارات الواتساب أولاً');
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/whatsapp/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`,
        },
        body: JSON.stringify({ action: 'test_message' }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('تم إرسال رسالة الاختبار! تحقق من واتساب 📱');
      } else {
        toast.error(data.error || 'فشل في إرسال رسالة الاختبار');
      }
    } catch (error) {
      console.error('Error sending test message:', error);
      toast.error('حدث خطأ في إرسال الرسالة');
    } finally {
      setTesting(false);
    }
  };

  const formatPhoneNumber = (value) => {
    // إزالة جميع الأحرف غير الرقمية
    const numbers = value.replace(/[^\d]/g, '');
    
    // تنسيق الرقم السعودي
    if (numbers.startsWith('966')) {
      return numbers.replace(/(\d{3})(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
    } else if (numbers.startsWith('05') || numbers.startsWith('5')) {
      const cleanNumber = numbers.startsWith('05') ? numbers.substring(1) : numbers;
      return `966 ${cleanNumber.replace(/(\d{2})(\d{3})(\d{4})/, '$1 $2 $3')}`;
    }
    
    return numbers;
  };

  const handlePhoneNumberChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setSettings(prev => ({ 
      ...prev, 
      whatsapp_number: formatted.replace(/\s/g, '') // حفظ بدون مسافات
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            إعدادات إشعارات الواتساب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">جاري التحميل...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-500" />
          إعدادات إشعارات الواتساب
        </CardTitle>
        <CardDescription>
          استلم إشعارات على الواتساب عند نشر منشورات جديدة من الأشخاص الذين تتابعهم
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* رقم الواتساب */}
        <div className="space-y-2">
          <Label htmlFor="whatsapp_number" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            رقم الواتساب
          </Label>
          <Input
            id="whatsapp_number"
            type="tel"
            placeholder="966 50 123 4567"
            value={formatPhoneNumber(settings.whatsapp_number)}
            onChange={handlePhoneNumberChange}
            className="text-left"
            dir="ltr"
          />
          <p className="text-sm text-muted-foreground">
            أدخل رقم الواتساب مع كود البلد (مثل: 966501234567)
          </p>
        </div>

        <Separator />

        {/* تفعيل الإشعارات */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="flex items-center gap-2">
              {settings.whatsapp_notifications_enabled ? (
                <Bell className="h-4 w-4 text-green-500" />
              ) : (
                <BellOff className="h-4 w-4 text-gray-400" />
              )}
              تفعيل إشعارات الواتساب
            </Label>
            <p className="text-sm text-muted-foreground">
              {settings.whatsapp_notifications_enabled 
                ? 'الإشعارات مفعلة - ستتلقى رسائل على الواتساب'
                : 'الإشعارات معطلة - لن تتلقى أي رسائل'
              }
            </p>
          </div>
          <Switch
            checked={settings.whatsapp_notifications_enabled}
            onCheckedChange={(checked) =>
              setSettings(prev => ({ ...prev, whatsapp_notifications_enabled: checked }))
            }
          />
        </div>

        <Separator />

        {/* تفضيلات الإشعارات */}
        <div className="space-y-4">
          <Label className="text-base font-medium">أنواع الإشعارات</Label>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>المنشورات الجديدة</Label>
                <p className="text-sm text-muted-foreground">
                  إشعار عند نشر منشور جديد من الأشخاص الذين تتابعهم
                </p>
              </div>
              <Switch
                checked={settings.notification_preferences.new_posts}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({
                    ...prev,
                    notification_preferences: {
                      ...prev.notification_preferences,
                      new_posts: checked
                    }
                  }))
                }
                disabled={!settings.whatsapp_notifications_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>تحديثات الأسعار</Label>
                <p className="text-sm text-muted-foreground">
                  إشعار عند وصول السهم للهدف أو وقف الخسارة
                </p>
              </div>
              <Switch
                checked={settings.notification_preferences.price_updates}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({
                    ...prev,
                    notification_preferences: {
                      ...prev.notification_preferences,
                      price_updates: checked
                    }
                  }))
                }
                disabled={!settings.whatsapp_notifications_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>تحديثات الاستراتيجية</Label>
                <p className="text-sm text-muted-foreground">
                  إشعار عند تحديث أو تعديل الاستراتيجية
                </p>
              </div>
              <Switch
                checked={settings.notification_preferences.strategy_updates}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({
                    ...prev,
                    notification_preferences: {
                      ...prev.notification_preferences,
                      strategy_updates: checked
                    }
                  }))
                }
                disabled={!settings.whatsapp_notifications_enabled}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* أزرار الإجراءات */}
        <div className="flex gap-3">
          <Button 
            onClick={handleSaveSettings} 
            disabled={saving}
            className="flex-1"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleTestMessage}
            disabled={testing || !settings.whatsapp_number || !settings.whatsapp_notifications_enabled}
          >
            {testing ? 'جاري الإرسال...' : 'اختبار الرسالة'}
          </Button>
        </div>

        {/* تنبيه أمان */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">معلومات مهمة:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• رقم الواتساب آمن ومشفر ولن يتم مشاركته مع أحد</li>
            <li>• يمكنك إيقاف الإشعارات في أي وقت</li>
            <li>• ستتلقى إشعارات فقط من الأشخاص الذين تتابعهم</li>
            <li>• الخدمة مجانية ولا توجد رسوم إضافية</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppSettings;