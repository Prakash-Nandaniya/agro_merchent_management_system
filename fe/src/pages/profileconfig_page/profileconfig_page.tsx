import Navbar from '@/components/navbar/navbar';
import ProfileConfiguration from '@/components/profile_configuration/profileconfig';
import GlobalDataLoader from '@/utils/DataLoader';

export default function ProfileConfigurationPage() {
  return (
    <GlobalDataLoader>
      <div className="min-h-screen bg-gray-300 print:bg-white">
        <Navbar />
        <ProfileConfiguration />
      </div>
    </GlobalDataLoader>
  );
}