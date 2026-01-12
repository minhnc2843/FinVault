import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Users, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, trend, color, testId }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card className="card-hover" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold tabular-nums">{value}</p>
            {trend && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${trend > 0 ? 'text-destructive' : 'text-success'}`}>
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}% so với tháng trước
              </p>
            )}
          </div>
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

export default function Dashboard() {
  const [statistics, setStatistics] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [sharedExpenses, setSharedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, transactionsRes, sharedRes] = await Promise.all([
        api.get('/statistics/overview?period=month'),
        api.get('/transactions'),
        api.get('/shared-expenses')
      ]);

      setStatistics(statsRes.data);
      setRecentTransactions(transactionsRes.data.slice(0, 5));
      setSharedExpenses(sharedRes.data.filter(exp => {
        const user = JSON.parse(localStorage.getItem('user'));
        const participant = exp.participants.find(p => p.user_id === user.id);
        return participant && !participant.confirmed;
      }));
    } catch (error) {
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
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
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground mt-1">Xem tình hình tài chính của bạn trong tháng này</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Tổng chi tiêu"
          value={formatCurrency(statistics?.total_expense || 0)}
          icon={TrendingDown}
          color="bg-destructive"
          testId="total-expense-card"
        />
        <StatCard
          title="Tổng thu nhập"
          value={formatCurrency(statistics?.total_income || 0)}
          icon={TrendingUp}
          color="bg-success"
          testId="total-income-card"
        />
        <StatCard
          title="Số dư"
          value={formatCurrency(statistics?.balance || 0)}
          icon={Wallet}
          color="bg-accent"
          testId="balance-card"
        />
        <StatCard
          title="Công nợ"
          value={formatCurrency(statistics?.total_owed || 0)}
          icon={Users}
          color="bg-warning"
          testId="debt-card"
        />
      </div>

      {/* Pending Confirmations */}
      {sharedExpenses.length > 0 && (
        <Card className="border-warning" data-testid="pending-expenses-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              <CardTitle>Khoản chi chung cần xác nhận ({sharedExpenses.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sharedExpenses.map((expense) => {
                const user = JSON.parse(localStorage.getItem('user'));
                const participant = expense.participants.find(p => p.user_id === user.id);
                return (
                  <div key={expense.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{expense.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Bạn cần trả: {formatCurrency(participant?.amount || 0)}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => navigate('/shared')} data-testid="view-shared-expense-btn">
                      Xem chi tiết
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card data-testid="recent-transactions-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Giao dịch gần đây</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} data-testid="view-all-transactions-btn">
              Xem tất cả <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có giao dịch nào</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors">
                  <div>
                    <p className="font-medium">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.date).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatCurrency(txn.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Button
          size="lg"
          onClick={() => navigate('/transactions')}
          className="h-16 text-base"
          data-testid="add-transaction-btn"
        >
          + Thêm giao dịch mới
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => navigate('/shared')}
          className="h-16 text-base"
          data-testid="add-shared-expense-btn"
        >
          + Tạo khoản chi chung
        </Button>
      </div>
    </div>
  );
}
