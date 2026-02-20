'use client';
import { Hamburguer } from '../HamburguerButton/HamburguerButton';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from '../Sidebar/Sidebar';
import { ISection } from '@/utils/interfaces';

export const MenuModal = ({ content }: { content: ISection[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  function toggleMenu() {
    setIsOpen(!isOpen);
  }

  return (
    <div className="flex flex-col">
      <Hamburguer toggle={toggleMenu}></Hamburguer>

      <div
        className={cn(
          'fixed top-16 right-0 h-50% w-[min(350px,100%)] bg-[#F6F3F0] py-10 shadow-2xl z-50',
          'transform transition-transform duration-500 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <Sidebar styles={' h-full w-full '} content={content}></Sidebar>
      </div>
    </div>
  );
};
