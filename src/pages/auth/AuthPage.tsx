import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function AuthPage() {
  const [selectedUser, setSelectedUser] = useState('');
  const navigate = useNavigate();

  const testUsers = [
    { email: 'admin@heartfulness.org', name: 'Admin', role: 'Administrator', icon: '👨‍💼' },
    { email: 'preceptor1@heartfulness.org', name: 'Adv Girish Shrivastav', role: 'Preceptor', icon: '🧘‍♂️' },
    { email: 'preceptor2@heartfulness.org', name: 'Anchal Shrivastava', role: 'Preceptor', icon: '🧘‍♀️' },
    { email: 'preceptor3@heartfulness.org', name: 'Krishnakant Shrivastava', role: 'Preceptor', icon: '🧘‍♂️' }
  ];

  const handleQuickLogin = (email: string, name: string) => {
    setSelectedUser(email);
    toast.success(`Welcome ${name}! 🙏`);

    // Auto-navigate after a brief moment
    setTimeout(() => {
      if (email === 'admin@heartfulness.org') {
        navigate('/admin');
      } else {
        navigate('/chat');
      }
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 via-white to-purple-50">
      <div className="max-w-lg w-full spiritual-card p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-800 mb-2 flex items-center justify-center gap-2">
            Heartfulness
            <img src="/hfn-logo-new.jpg" alt="Logo" className="h-10 w-10 rounded-full object-cover" />
          </h1>
          <p className="text-gray-600">Spiritual Learning System</p>
          <p className="text-xs text-purple-600 mt-2">Quick Login for Testing</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-4">Select User to Login:</p>

          {testUsers.map((user) => (
            <div
              key={user.email}
              onClick={() => handleQuickLogin(user.email, user.name)}
              className={`
                flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all
                ${selectedUser === user.email
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50/50'
                }
              `}
            >
              <input
                type="radio"
                name="user"
                checked={selectedUser === user.email}
                onChange={() => { }}
                className="w-4 h-4 text-purple-600 focus:ring-purple-500"
              />

              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{user.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-600">{user.email}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                  {user.role}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-800 font-medium mb-1">💡 Quick Login Enabled</p>
          <p className="text-xs text-purple-700">
            Click any user to instantly login and navigate to their dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
