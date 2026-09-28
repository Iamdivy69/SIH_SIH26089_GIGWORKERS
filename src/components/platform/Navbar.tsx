"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { BrandMark } from './brand';
import { ROLE_HOME, useAppStore, useRole } from '@/store/app-store';
import './Navbar.css';

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Roles', href: '#roles' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
];

const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

interface NavbarProps {
  onEnter?: (role: 'customer' | 'worker' | 'admin') => void;
}

export function Navbar({ onEnter }: NavbarProps) {
  const welcomeSeen = useAppStore((state) => state.welcomeSeen);
  const dismissWelcome = useAppStore((state) => state.dismissWelcome);
  const navigate = useAppStore((state) => state.navigate);
  const role = useRole();

  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === 'dark';

  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 80);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCtaClick = () => {
    if (welcomeSeen) {
      dismissWelcome();
      navigate(ROLE_HOME[role] || 'customer-home');
    } else if (onEnter) {
      onEnter('customer');
    } else {
      dismissWelcome();
      navigate(ROLE_HOME.customer);
    }
  };

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <nav className={`navbar-wrapper ${hidden ? 'navbar-wrapper--hidden' : ''}`} aria-label="Main Navigation">
      <div className="navbar">
        {/* Brand logo & title */}
        <a href="#top" onClick={handleLogoClick} className="navbar-logo" title="Sahyog — Home">
          <span className="navbar-logo-icon">
            <BrandMark size={26} />
          </span>
          <span className="navbar-logo-text">Sahyog</span>
        </a>

        {/* Hackathon Badge preserved from current header */}
        <span className="navbar-badge" title="Smart India Hackathon 2025 · SIH26089">
          SIH26089
        </span>

        {/* Rolling text navigation links */}
        <ul className="navbar-links">
          {LINKS.map((item) => (
            <li key={item.label}>
              <a
                href={item.href}
                onClick={(e) => handleLinkClick(e, item.href)}
                className="navbar-link"
              >
                <span className="navbar-link-inner">
                  <span className="navbar-link-top">{item.label}</span>
                  <span className="navbar-link-bottom">{item.label}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* Theme Toggle Feature preserved from current header */}
        <button
          type="button"
          onClick={toggleTheme}
          className="navbar-theme-btn"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* CTA with dual-arrow slide animation */}
        <div className="navbar-cta-link">
          <button type="button" onClick={handleCtaClick} className="navbar-cta">
            <span className="navbar-cta-arrow-enter" aria-hidden="true">
              <ArrowRight className="navbar-cta-icon" />
            </span>
            <span className="navbar-cta-arrow-wrap">
              <span className="navbar-cta-arrow-exit" aria-hidden="true">
                <ArrowRight className="navbar-cta-icon" />
              </span>
              {welcomeSeen ? 'Dashboard' : 'Start Demo'}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
