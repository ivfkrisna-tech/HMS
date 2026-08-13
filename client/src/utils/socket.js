import io from 'socket.io-client';

const getSocketURL = () => {
    if (import.meta.env.MODE === 'development') {
        return ''; // Allow Vite proxy to handle it, or use same origin
    }
    return import.meta.env.VITE_API_URL || 'https://hms-ivf-docker.onrender.com';
};

const socket = io(getSocketURL(), {
    autoConnect: false // Connect manually when authenticated
});

export default socket;
