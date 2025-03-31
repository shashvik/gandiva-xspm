import React, { useState, useEffect } from 'react';
import { Users, Search, UserPlus, Edit, Trash2, Loader2 } from 'lucide-react';
import TopNavBar from '@/components/TopNavBar';
import AdminPanel from '@/components/AdminPanel';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { authAxios } from '@/services/auth';
import UserForm, { UserFormData } from '@/components/UserForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getUsers, createUser, updateUser, deleteUser } from '@/services/api';

// Define user interface
interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
  lastLogin: string;
  status: string;
}

const UsersPage: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserFormData | undefined>(undefined);
  const [userToDelete, setUserToDelete] = useState<string | number | null>(null);
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Get users from the API
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users. Please try again.',
        variant: 'destructive',
      });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
    if (darkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleAddUser = () => {
    setCurrentUser(undefined);
    setIsEditMode(false);
    setIsUserFormOpen(true);
  };
  
  const handleEditUser = (userId: string | number) => {
    const userToEdit = users.find(user => user.id === userId);
    if (userToEdit) {
      setCurrentUser({
        id: userToEdit.id,
        username: userToEdit.name,
        email: userToEdit.email,
        password: '',
        confirmPassword: '',
        role: userToEdit.role.toLowerCase()
      });
      setIsEditMode(true);
      setIsUserFormOpen(true);
    }
  };
  
  const handleDeleteUser = (userId: string | number) => {
    setUserToDelete(userId);
  };
  
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      await deleteUser(userToDelete);
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      
      // Update users list
      setUsers(users.filter(user => user.id !== userToDelete));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setUserToDelete(null);
    }
  };
  
  const handleUserFormSubmit = async (formData: UserFormData) => {
    try {
      if (isEditMode && formData.id) {
        // Update existing user
        const data = {
          email: formData.email,
          role: formData.role,
          ...(formData.password ? { password: formData.password } : {})
        };
        
        await updateUser(formData.id, data);
        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
        
        // Update the user in the list
        setUsers(users.map(user => 
          user.id === formData.id
            ? {
                ...user,
                email: formData.email,
                role: formData.role === 'admin' ? 'Administrator' : 
                     formData.role === 'operator' ? 'Operator' : 'User'
              }
            : user
        ));
      } else {
        // Create new user
        const data = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role
        };
        
        const result = await createUser(data);
        toast({
          title: 'Success',
          description: 'User created successfully',
        });
        
        // Add the new user to the list
        const newUser: User = {
          id: result.username || result.id,
          name: result.username || data.username,
          email: data.email,
          role: data.role === 'admin' ? 'Administrator' : 
               data.role === 'operator' ? 'Operator' : 'User',
          lastLogin: new Date().toISOString(),
          status: 'active'
        };
        
        setUsers([...users, newUser]);
      }
      
      // Close the form
      setIsUserFormOpen(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 
                      (isEditMode ? 'Failed to update user' : 'Failed to create user');
      
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    }
  };
  
  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true;
    
    return (
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  // Format date for display
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-black' : 'bg-white'} flex`}>
      {/* Admin Panel */}
      <AdminPanel darkMode={darkMode} />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Nav Bar */}
        <TopNavBar 
          title="User Management" 
          darkMode={darkMode} 
          toggleTheme={toggleTheme} 
          setShowSettings={setShowSettings} 
        />
        
        {/* Main Content Below Header */}
        <div className="p-6 relative">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[10px] opacity-50">
              <div className={`w-full h-full ${darkMode ? 'bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10' : 'bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100'}`}>
                <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-repeat-[24px_24px]" />
              </div>
            </div>
          </div>
          
          {/* User Management Content */}
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold">Users</h1>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className="pl-10 w-64"
                  />
                </div>
                <button
                  onClick={handleAddUser}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md
                    ${darkMode 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                >
                  <UserPlus size={16} />
                  <span>Add User</span>
                </button>
              </div>
            </div>
            
            {/* Users Table */}
            <div className={`rounded-lg overflow-hidden shadow-sm mb-6 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white'}`}>
              <div className={`overflow-x-auto ${darkMode ? 'scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900' : 'scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-gray-100'}`}>
                {isLoading ? (
                  <div className="flex justify-center items-center p-8">
                    <Loader2 className={`h-8 w-8 animate-spin ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                    <span className="ml-2">Loading users...</span>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className={`text-left text-xs uppercase ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                      <tr>
                        <th className="px-6 py-3 font-medium">Name</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Role</th>
                        <th className="px-6 py-3 font-medium">Last Login</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td 
                            colSpan={6}
                            className={`px-6 py-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            No users found. Try adjusting your search term.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id} className={`text-sm ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.role}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {formatDate(user.lastLogin)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${user.status === 'active' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'}`}
                              >
                                {user.status === 'active' ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-3">
                                <button
                                  onClick={() => handleEditUser(user.id)}
                                  className={`p-1 rounded-full ${darkMode ? 'text-blue-400 hover:bg-gray-600' : 'text-blue-600 hover:bg-gray-200'}`}
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className={`p-1 rounded-full ${darkMode ? 'text-red-400 hover:bg-gray-600' : 'text-red-600 hover:bg-gray-200'}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* User Form Modal */}
      <UserForm
        isOpen={isUserFormOpen}
        onClose={() => setIsUserFormOpen(false)}
        onSubmit={handleUserFormSubmit}
        initialData={currentUser}
        isEdit={isEditMode}
      />
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={userToDelete !== null} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user and remove their data from the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersPage; 