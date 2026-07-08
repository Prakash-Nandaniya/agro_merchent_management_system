import Navbar from '@/components/navbar/navbar';
import ProfileConfiguration from '@/components/profile_configuration/profileconfig';

export default function ProfileConfigurationPage() {
  return (
    <div className="min-h-screen bg-gray-300 print:bg-white">
      <Navbar />
      <ProfileConfiguration />
    </div>
  );
}