import { useEffect, useState } from "react";
import { BookOpen, Home, Info, LogIn, LogOut, Search, User } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Header() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, firebaseUser => {
    setUser(firebaseUser);
    setAuthLoading(false);
  }), []);

  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/read");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  const navClass = ({ isActive }) => isActive ? "nav-link active" : "nav-link";

  return (
    <header className="site-header rr-header">
      <NavLink to="/read" className="brand rr-brand">
        <img className="rr-brand-logo" src="/branding/random-reads-logo.svg" alt="Random Reads" />
      </NavLink>

      <nav className="top-nav" aria-label="Random Reads navigation">
        <NavLink to="/read" end className={navClass}><Home size={18}/><span>Home</span></NavLink>
        <NavLink to="/read/search" className={navClass}><Search size={18}/><span>Search</span></NavLink>
        <NavLink to="/read/journal" className={navClass}><BookOpen size={18}/><span>Journal</span></NavLink>
        <NavLink to="/read/about" className={navClass}><Info size={18}/><span>About</span></NavLink>
        {!authLoading && !user && (
          <NavLink to="/read/login" className={navClass}><LogIn size={18}/><span>Log In</span></NavLink>
        )}
        {!authLoading && user && (
          <>
            <NavLink to="/read/profile"  className={navClass}
>
  <User size={18} />
  <span>Profile</span>
</NavLink>
            <button type="button" className="nav-link" onClick={handleLogout}><LogOut size={18}/><span>Log Out</span></button>
          </>
        )}
      </nav>

      <a className="rr-foundation-link" href="/">The Literature Foundation</a>
    </header>
  );
}
