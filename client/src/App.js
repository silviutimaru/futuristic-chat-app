import React, { useState } from "react";
import axios from "axios";

// Set your backend URL here
const API_BASE = "https://futuristic-chat-app-production.up.railway.app";

function App() {
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [showRegister, setShowRegister] = useState(false);
  const [authError, setAuthError] = useState("");

  // Login/Register form state
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    country: "",
    gender: "male",
    language: "en",
    is18OrOlder: false,
  });

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        email: form.email,
        password: form.password,
      });
      if (res.data && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
      } else {
        setAuthError("Login failed. Please check your credentials.");
      }
    } catch (err) {
      setAuthError(
        err.response?.data?.errors?.[0]?.msg ||
          "Login failed. Please check your credentials."
      );
    }
  };

  // Handle register
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!form.is18OrOlder) {
      setAuthError("You must confirm you are 18 or older.");
      return;
    }
    try {
      await axios.post(`${API_BASE}/auth/register`, {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        country: form.country,
        gender: form.gender,
        language: form.language,
        is18OrOlder: form.is18OrOlder,
      });
      setAuthError(
        "Registration successful! Please check your email to activate your account."
      );
      setShowRegister(false);
    } catch (err) {
      setAuthError(
        err.response?.data?.errors?.[0]?.msg ||
          "Registration failed. Please try again."
      );
    }
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  // If not logged in, show login/register form
  if (!user) {
    return (
      <div style={{ maxWidth: 400, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
        <h2>{showRegister ? "Register" : "Login"}</h2>
        <form onSubmit={showRegister ? handleRegister : handleLogin}>
          <div style={{ marginBottom: 10 }}>
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Password:</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{ width: "100%" }}
            />
          </div>
          {showRegister && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label>First Name:</label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>Last Name:</label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>Country:</label>
                <input
                  type="text"
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  required
                  style={{ width: "100%" }}
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>Gender:</label>
                <select
                  name="gender"
                  value={form.gender}
                  onChange={handleChange}
                  style={{ width: "100%" }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>Language:</label>
                <select
                  name="language"
                  value={form.language}
                  onChange={handleChange}
                  style={{ width: "100%" }}
                >
                  <option value="en">English</option>
                  <option value="ro">Romanian</option>
                  <option value="hu">Hungarian</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                  {/* Add more languages as needed */}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>
                  <input
                    type="checkbox"
                    name="is18OrOlder"
                    checked={form.is18OrOlder}
                    onChange={handleChange}
                  />{" "}
                  I confirm I am 18 or older
                </label>
              </div>
            </>
          )}
          {authError && (
            <div style={{ color: "red", marginBottom: 10 }}>{authError}</div>
          )}
          <button type="submit" style={{ width: "100%", padding: 10 }}>
            {showRegister ? "Register" : "Login"}
          </button>
        </form>
        <div style={{ marginTop: 10 }}>
          {showRegister ? (
            <span>
              Already have an account?{" "}
              <button onClick={() => setShowRegister(false)}>Login</button>
            </span>
          ) : (
            <span>
              Don't have an account?{" "}
              <button onClick={() => setShowRegister(true)}>Register</button>
            </span>
          )}
        </div>
      </div>
    );
  }

  // If logged in, show the main app (replace with your chat/dashboard component)
  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Welcome, {user.firstName}!</h2>
        <button onClick={handleLogout} style={{ padding: 8, borderRadius: 4 }}>
          Logout
        </button>
      </div>
      {/* Here you can render your chat/dashboard component */}
      <p>This is where your chat and app features will appear after login.</p>
    </div>
  );
}

export default App;
