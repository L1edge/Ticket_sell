import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [theme, setTheme] = useState('light');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [events, setEvents] = useState([]);
  
  const [authForm, setAuthForm] = useState({ email: '', password: '', isLogin: true });
  const [newEvent, setNewEvent] = useState({ title: '', total_tickets: 100, base_price: 100, increase_step: 20, threshold: 10 });
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API_URL}/events`);
      setEvents(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (token) fetchEvents();
  }, [token]);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authForm.isLogin ? '/login' : '/register';
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, { email: authForm.email, password: authForm.password });
      if (authForm.isLogin) {
        setToken(res.data.token);
        localStorage.setItem('token', res.data.token);
      } else {
        showMessage('Зареєстровано! Тепер увійдіть.', 'success');
        setAuthForm({ ...authForm, isLogin: true });
      }
    } catch (error) {
      showMessage(error.response?.data?.error || 'Помилка авторизації', 'error');
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/events`, newEvent);
      showMessage('Подію успішно створено!', 'success');
      fetchEvents();
    } catch (error) {
      showMessage('Помилка створення події', 'error');
    }
  };

  const buyTicket = async (eventId) => {
    try {
      const res = await axios.post(`${API_URL}/buy-ticket`, { eventId, amount: 1 });
      
      // Динамічне оновлення інтерфейсу без перезавантаження
      setEvents(events.map(ev => 
        ev.id === eventId 
          ? { ...ev, current_price: res.data.new_current_price, sold_tickets: res.data.new_sold_tickets } 
          : ev
      ));
    } catch (error) {
      showMessage(error.response?.data?.error || 'Помилка покупки', 'error');
    }
  };

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  if (!token) {
    return (
      <div className="auth-container">
        <div className="card auth-card">
          <h2>{authForm.isLogin ? 'Вхід у систему' : 'Реєстрація'}</h2>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <input type="password" placeholder="Пароль" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            <button type="submit" className="btn-primary">{authForm.isLogin ? 'Увійти' : 'Створити акаунт'}</button>
          </form>
          <p onClick={() => setAuthForm({...authForm, isLogin: !authForm.isLogin})}>
            {authForm.isLogin ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
          </p>
          {message.text && <div className={`alert ${message.type}`}>{message.text}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Платформа Квитків</h1>
        <div className="header-actions">
          <button className="btn-icon" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="btn-outline-danger" onClick={() => { setToken(''); localStorage.removeItem('token'); }}>Вийти</button>
        </div>
      </header>

      {message.text && <div className={`alert ${message.type}`}>{message.text}</div>}

      <div className="main-content">
        <aside className="sidebar">
          <div className="card">
            <h2 className="section-title">Створити подію</h2>
            <form className="create-form" onSubmit={createEvent}>
              <div className="input-group">
                <input type="text" placeholder="Назва події" required onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
              </div>
              <div className="input-group">
                <span className="icon">👥</span>
                <input type="number" placeholder="Всього квитків" required onChange={e => setNewEvent({...newEvent, total_tickets: Number(e.target.value)})} />
              </div>
              <div className="input-group">
                <span className="icon">💰</span>
                <input type="number" placeholder="Початкова ціна" required onChange={e => setNewEvent({...newEvent, base_price: Number(e.target.value)})} />
              </div>
              <div className="input-group">
                <span className="icon">📈</span>
                <input type="number" placeholder="Крок ціни" required onChange={e => setNewEvent({...newEvent, increase_step: Number(e.target.value)})} />
              </div>
              <div className="input-group">
                <span className="icon">⏱️</span>
                <input type="number" placeholder="Порог квитків" required onChange={e => setNewEvent({...newEvent, threshold: Number(e.target.value)})} />
              </div>
              <button type="submit" className="btn-success">Додати подію</button>
            </form>
          </div>
        </aside>

        <section className="events-grid">
          {events.map(event => (
            <div className="card event-card" key={event.id}>
              <h3>{event.title}</h3>
              <div className="event-details">
                <div className="price-block">
                  <span className="price">{event.current_price} грн</span>
                  <span className="stats">Продано: {event.sold_tickets} / {event.total_tickets}</span>
                </div>
                <button 
                  className="btn-info" 
                  onClick={() => buyTicket(event.id)} 
                  disabled={event.sold_tickets >= event.total_tickets}
                >
                  Купити квиток
                </button>
              </div>
              <div className="progress-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${(event.sold_tickets / event.total_tickets) * 100}%` }}
                ></div>
                <span className="progress-text">
                  {event.sold_tickets} квитків продано (з {event.total_tickets})
                </span>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default App;