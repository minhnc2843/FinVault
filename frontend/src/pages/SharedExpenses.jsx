import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Check, X, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import api from '@/utils/api';

export default function SharedExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    total_amount: '',
    currency: 'VND',
    participant_emails: [''],
    split_type: 'equal',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await api.get('/shared-expenses');
      setExpenses(response.data);
    } catch (error) {
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const validEmails = formData.participant_emails.filter(email => email.trim() !== '');
      await api.post('/shared-expenses', {
        ...formData,
        total_amount: parseFloat(formData.total_amount),
        participant_emails: validEmails,
        date: new Date(formData.date).toISOString()
      });
      toast.success('Đã tạo khoản chi chung');
      setIsDialogOpen(false);
      fetchExpenses();
      setFormData({
        title: '',
        description: '',
        total_amount: '',
        currency: 'VND',
        participant_emails: [''],
        split_type: 'equal',
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể tạo khoản chi chung');
    }
  };

  const handleConfirm = async (expenseId) => {
    try {
      await api.post(`/shared-expenses/${expenseId}/confirm`);
      toast.success('Đã xác nhận khoản chi');
      fetchExpenses();
    } catch (error) {
      toast.error('Không thể xác nhận');
    }
  };

  const viewSettlements = async (expenseId) => {
    try {
      const response = await api.get(`/shared-expenses/${expenseId}/settlements`);
      setSettlements(response.data);
      setSelectedExpense(expenses.find(exp => exp.id === expenseId));
    } catch (error) {
      toast.error('Không thể tải thông tin thanh toán');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const addEmailField = () => {
    setFormData({
      ...formData,
      participant_emails: [...formData.participant_emails, '']
    });
  };

  const updateEmail = (index, value) => {
    const newEmails = [...formData.participant_emails];
    newEmails[index] = value;
    setFormData({ ...formData, participant_emails: newEmails });
  };

  const removeEmail = (index) => {
    const newEmails = formData.participant_emails.filter((_, i) => i !== index);
    setFormData({ ...formData, participant_emails: newEmails });
  };

  const currentUser = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="space-y-6" data-testid="shared-expenses-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Chi tiêu chung</h1>
          <p className="text-muted-foreground mt-1">Quản lý và chia sẻ chi phí với bạn bè</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="create-shared-expense-button">
              <Plus className="h-4 w-4 mr-2" /> Tạo khoản chi chung
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="shared-expense-dialog">
            <DialogHeader>
              <DialogTitle>Tạo khoản chi chung mới</DialogTitle>
              <DialogDescription>Chia sẻ chi phí với bạn bè và gia đình</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tiêu đề</Label>
                <Input
                  data-testid="title-input"
                  placeholder="Ví dụ: Ăn tối nhà hàng"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Mô tả</Label>
                <Input
                  data-testid="description-input"
                  placeholder="Chi tiết về khoản chi"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tổng số tiền</Label>
                  <Input
                    type="number"
                    data-testid="total-amount-input"
                    placeholder="0"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ngày</Label>
                  <Input
                    type="date"
                    data-testid="date-input"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Người tham gia (nhập email)</Label>
                {formData.participant_emails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      data-testid={`participant-email-${index}`}
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                    />
                    {formData.participant_emails.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeEmail(index)}
                        data-testid={`remove-email-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEmailField}
                  data-testid="add-participant-button"
                >
                  + Thêm người
                </Button>
              </div>

              <Button type="submit" className="w-full" data-testid="submit-shared-expense-button">
                Tạo khoản chi chung
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Expenses List */}
      <div className="grid gap-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Đang tải...</p>
        ) : expenses.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <p className="text-center text-muted-foreground">Chưa có khoản chi chung nào</p>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => {
            const currentUserParticipant = expense.participants.find(p => p.user_id === currentUser.id);
            const isCreator = expense.creator_id === currentUser.id;
            
            return (
              <motion.div
                key={expense.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="shared-expense-card"
              >
                <Card className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-2xl">{expense.title}</CardTitle>
                        <p className="text-muted-foreground mt-1">{expense.description}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold tabular-nums">{formatCurrency(expense.total_amount)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(expense.date).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Người tham gia ({expense.participants.length})</span>
                        </div>
                        <div className="space-y-2">
                          {expense.participants.map((participant) => (
                            <div key={participant.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
                                  {participant.full_name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium">{participant.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{participant.email}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold tabular-nums">{formatCurrency(participant.amount)}</p>
                                {participant.confirmed ? (
                                  <Badge variant="success" className="mt-1">
                                    <Check className="h-3 w-3 mr-1" /> Đã xác nhận
                                  </Badge>
                                ) : (
                                  <Badge variant="warning" className="mt-1">Chờ xác nhận</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-3">
                        {currentUserParticipant && !currentUserParticipant.confirmed && (
                          <Button
                            onClick={() => handleConfirm(expense.id)}
                            className="flex-1"
                            data-testid="confirm-expense-button"
                          >
                            <Check className="h-4 w-4 mr-2" /> Xác nhận khoản chi
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => viewSettlements(expense.id)}
                          className="flex-1"
                          data-testid="view-settlements-button"
                        >
                          <Calculator className="h-4 w-4 mr-2" /> Xem thanh toán
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Settlements Dialog */}
      <Dialog open={selectedExpense !== null} onOpenChange={() => setSelectedExpense(null)}>
        <DialogContent data-testid="settlements-dialog">
          <DialogHeader>
            <DialogTitle>Thanh toán - {selectedExpense?.title}</DialogTitle>
            <DialogDescription>Chi tiết công nợ của từng người</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {settlements.map((settlement) => (
              <div key={settlement.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{settlement.user_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Đã trả: {formatCurrency(settlement.amount_paid)} / {formatCurrency(settlement.amount_owed)}
                  </p>
                </div>
                <div className="text-right">
                  {settlement.balance >= 0 ? (
                    <Badge variant="success">Đã thanh toán</Badge>
                  ) : (
                    <div>
                      <Badge variant="destructive">Còn nợ</Badge>
                      <p className="text-sm font-semibold text-destructive mt-1">
                        {formatCurrency(Math.abs(settlement.balance))}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
