import axios from 'axios';

const API = axios.create({ 
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api' 
});

API.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('gfg_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

API.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('gfg_token');
            localStorage.removeItem('gfg_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default API;
