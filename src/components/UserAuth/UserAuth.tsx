'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ButtonUi } from '../ButtonUI/ButtonUI';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '../Icon/Icon';

export const UserAuth = () => {
  const { user, loading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login">
        <ButtonUi label="Entrar" />
      </Link>
    );
  }

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    if (pathname.startsWith('/platform')) {
      router.push('/');
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center cursor-pointer w-10 h-10 rounded-full hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-[#777E32] transition-colors"
        aria-label="Menu do usuário"
      >
        <Icon id="user" size={24} className="stroke-[#21240F]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-md shadow-lg py-1 z-50">
          <div className="px-4 py-3 border-b border-stone-100">
            <p className="text-sm font-medium text-stone-900">Usuário Logado</p>
            <p className="text-sm text-stone-500 truncate" title={user.email || ''}>
              {user.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left cursor-pointer px-4 py-2 text-sm font-medium text-red-600 hover:bg-stone-100 transition-colors"
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
};
