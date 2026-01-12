import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Search, Trash2, Calendar, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/utils/api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    currency: 'VND',
    description: '',
    date: new Date().toISOString().split('T')[0],
    tags: []
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [txnRes, catRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/categories')
      ]);
      setTransactions(txnRes.data);
      setCategories(catRes.data);
    } catch (error) {
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/transactions', {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString()
      });
      toast.success('Đã thêm giao dịch');
      setIsDialogOpen(false);
      fetchData();
      setFormData({
        category_id: '',
        amount: '',
        currency: 'VND',
        description: '',
        date: new Date().toISOString().split('T')[0],
        tags: []
      });
    } catch (error) {
      toast.error('Không thể thêm giao dịch');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      toast.success('Đã xóa giao dịch');
      fetchData();
    } catch (error) {
      toast.error('Không thể xóa giao dịch');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch = txn.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || txn.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryById = (id) => categories.find(cat => cat.id === id);

  return (
    <div className="space-y-6" data-testid="transactions-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Giao dịch</h1>
          <p className="text-muted-foreground mt-1">Quản lý tất cả chi tiêu của bạn</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="add-transaction-button">
              <Plus className="h-4 w-4 mr-2" /> Thêm giao dịch
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="transaction-dialog">
            <DialogHeader>
              <DialogTitle>Thêm giao dịch mới</DialogTitle>
              <DialogDescription>Ghi lại chi tiêu hoặc thu nhập của bạn</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Danh mục</Label>
                <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })} required>
                  <SelectTrigger data-testid="category-select">
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Số tiền</Label>
                <Input
                  type="number"
                  data-testid="amount-input"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Mô tả</Label>
                <Input
                  data-testid="description-input"
                  placeholder="Ví dụ: Ăn trưa"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

              <Button type="submit" className="w-full" data-testid="submit-transaction-button">
                Thêm giao dịch
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm giao dịch..."
                data-testid="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="filter-category-select">
                <SelectValue placeholder="Lọc theo danh mục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả danh mục</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card data-testid="transactions-list">
        <CardHeader>
          <CardTitle>Danh sách giao dịch ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Đang tải...</p>
          ) : filteredTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có giao dịch nào</p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredTransactions.map((txn) => {
                  const category = getCategoryById(txn.category_id);
                  return (
                    <motion.div
                      key={txn.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg transition-colors border"
                      data-testid="transaction-item"
                    >
                      <div className="flex items-center gap-4">
                        <div 
                          className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: category?.color || '#64748B' }}
                        >
                          {category?.name.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-medium">{txn.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{category?.name || 'Khác'}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(txn.date).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`font-bold text-lg tabular-nums ${category?.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {category?.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid="delete-transaction-button"
                          onClick={() => handleDelete(txn.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
