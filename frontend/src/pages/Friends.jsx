import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Users, Check, X, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/utils/api';

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendEmail, setFriendEmail] = useState('');

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/friends');
      setFriends(response.data);
    } catch (error) {
      toast.error('Không thể tải danh sách bạn bè');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/users/search?q=${query}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSendRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/friends/request', { friend_email: friendEmail });
      toast.success('Đã gửi lời mời kết bạn');
      setIsDialogOpen(false);
      setFriendEmail('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Không thể gửi lời mời');
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await api.post(`/friends/${friendshipId}/accept`);
      toast.success('Đã chấp nhận lời mời kết bạn');
      fetchFriends();
    } catch (error) {
      toast.error('Không thể chấp nhận lời mời');
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingRequests = friends.filter(f => f.status === 'pending' && f.friend_id === currentUser.id);

  return (
    <div className="space-y-6" data-testid="friends-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Bạn bè</h1>
          <p className="text-muted-foreground mt-1">Quản lý bạn bè và kết nối mới</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" data-testid="add-friend-button">
              <UserPlus className="h-4 w-4 mr-2" /> Thêm bạn
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="add-friend-dialog">
            <DialogHeader>
              <DialogTitle>Thêm bạn mới</DialogTitle>
              <DialogDescription>Gửi lời mời kết bạn qua email</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSendRequest} className="space-y-4">
              <div className="space-y-2">
                <Label>Email bạn bè</Label>
                <Input
                  type="email"
                  data-testid="friend-email-input"
                  placeholder="email@example.com"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" data-testid="send-friend-request-button">
                Gửi lời mời
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <Card data-testid="pending-requests-card">
          <CardHeader>
            <CardTitle>Lời mời kết bạn ({pendingRequests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  data-testid="friend-request-item"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-lg">
                      {request.friend_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{request.friend_name}</p>
                      <p className="text-sm text-muted-foreground">{request.friend_email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(request.id)}
                      data-testid="accept-friend-button"
                    >
                      <Check className="h-4 w-4 mr-1" /> Chấp nhận
                    </Button>
                    <Button size="sm" variant="outline" data-testid="reject-friend-button">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      <Card data-testid="friends-list-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Danh sách bạn bè ({acceptedFriends.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm bạn bè..."
                data-testid="search-friends-input"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Đang tải...</p>
          ) : acceptedFriends.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Bạn chưa có bạn bè nào</p>
              <Button className="mt-4" onClick={() => setIsDialogOpen(true)} data-testid="add-first-friend-button">
                Thêm bạn đầu tiên
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {acceptedFriends.map((friend) => (
                <motion.div
                  key={friend.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  data-testid="friend-card"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-xl">
                      {friend.friend_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{friend.friend_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{friend.friend_email}</p>
                      <Badge variant="success" className="mt-2">
                        <Check className="h-3 w-3 mr-1" /> Bạn bè
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kết quả tìm kiếm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium">
                      {user.full_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    <UserPlus className="h-4 w-4 mr-1" /> Kết bạn
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
