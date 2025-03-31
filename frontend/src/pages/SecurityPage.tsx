import React from 'react';
import SecurityBanner from '../components/SecurityBanner';

interface SecurityPageProps {
  darkMode: boolean;
}

const SecurityPage: React.FC<SecurityPageProps> = ({ darkMode }) => {
  return (
    <div className="min-h-screen">
      <SecurityBanner darkMode={darkMode} />
    </div>
  );
};

export default SecurityPage; 