import { useNavigate } from 'react-router-dom';
import './profilrconfigbutton.css';


export default function ProfileCofigButton() {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate("/profile-configuration");
    };

    return (
        <button onClick={handleClick} >Profile Configuration</button >
    );
}