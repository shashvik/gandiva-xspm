import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { login } from '@/services/auth';
import { toast } from 'sonner';

interface LoginFormProps {
  darkMode?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ darkMode = false }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }
    
    setIsLoading(true);
    
    try {
      await login(username, password);
      toast.success("Successfully logged in");
      navigate('/'); // Redirect to main page
    } catch (error: any) {
      console.error('Login failed:', error);
      toast.error(error.response?.data?.message || "Invalid credentials, please try again");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1.5">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full bg-gray-800/50 border-gray-700 text-white h-11 rounded-md"
              disabled={isLoading}
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-gray-800/50 border-gray-700 text-white h-11 rounded-md"
              disabled={isLoading}
              required
            />
          </div>
        </div>
        
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-md transition-colors duration-200 font-medium"
        >
          {isLoading ? 'Authenticating...' : 'Sign In'}
        </Button>
        
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-600"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                Remember me
              </label>
            </div>
            
            <div className="text-sm">
              <a href="#" className="font-medium text-blue-500 hover:text-blue-400">
                Forgot password?
              </a>
            </div>
          </div>
        </div>
      </form>
      
      <div className="mt-8 pt-6 border-t border-gray-700/50">
        <p className="text-center text-sm text-gray-400">
          Need access? <a href="#" className="font-medium text-blue-500 hover:text-blue-400">Contact your administrator</a>
        </p>
      </div>
    </div>
  );
};

export default LoginForm; 