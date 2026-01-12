import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, DollarSign, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/utils/api';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    currency_preference: 'VND',
    usd_vnd_rate: 25000
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      setFormData({
        currency_preference: response.data.currency_preference,
        usd_vnd_rate: response.data.usd_vnd_rate
      });
    } catch (error) {
      toast.error('Không thể tải thông tin');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put('/users/profile', {
        currency_preference: formData.currency_preference,
        usd_vnd_rate: parseFloat(formData.usd_vnd_rate)
      });
      toast.success('Đã cập nhật thông tin');
      fetchProfile();
    } catch (error) {
      toast.error('Không thể cập nhật');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl" data-testid="profile-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Hồ sơ</h1>
        <p className="text-muted-foreground mt-1">Quản lý thông tin cá nhân và cài đặt</p>
      </div>

      {/* Profile Info */}
      <Card data-testid="profile-info-card">
        <CardHeader>
          <CardTitle>Thông tin cá nhân</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-4xl">
              {user?.full_name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user?.full_name}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tham gia: {new Date(user?.created_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency Settings */}
      <Card data-testid="currency-settings-card">
        <CardHeader>
          <CardTitle>Cài đặt tiền tệ</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tiền tệ uu tiên</Label>
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={formData.currency_preference === 'VND' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, currency_preference: 'VND' })}
                  data-testid="currency-vnd-button"
                >
                  VND (₫)
                </Button>
                <Button
                  type="button"
                  variant={formData.currency_preference === 'USD' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, currency_preference: 'USD' })}
                  data-testid="currency-usd-button"
                >
                  USD ($)
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Tỷ giá USD/VND</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  data-testid="exchange-rate-input"
                  value={formData.usd_vnd_rate}
                  onChange={(e) => setFormData({ ...formData, usd_vnd_rate: e.target.value })}
                  placeholder="25000"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">₫ / $1</span>
              </div>
              <p className="text-xs text-muted-foreground">
                1 USD = {formatCurrency(formData.usd_vnd_rate)}
              </p>
            </div>

            <Button type="submit" className="w-full" data-testid="save-settings-button">
              <Save className="h-4 w-4 mr-2" /> Lưu cài đặt
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <User className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{user?.full_name.split(' ').length > 1 ? user.full_name.split(' ')[0] : user?.full_name}</p>
            <p className="text-sm text-muted-foreground">Tên người dùng</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="h-8 w-8 mx-auto mb-2 text-success" />
            <p className="text-2xl font-bold">{formData.currency_preference}</p>
            <p className="text-sm text-muted-foreground">Tiền tệ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-bold mx-auto mb-2">💸</div>
            <p className="text-2xl font-bold">{formatCurrency(formData.usd_vnd_rate)}</p>
            <p className="text-sm text-muted-foreground">Tỷ giá</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
