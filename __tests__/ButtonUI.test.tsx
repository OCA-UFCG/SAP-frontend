import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ButtonUi } from '../src/components/ButtonUI/ButtonUI';

describe('Componente: ButtonUi', () => {
  
  it('render label', () => {
    render(<ButtonUi label="Label" styles="" />);
    
    const buttonElement = screen.getByRole('button', { name: /label/i });
    
    expect(buttonElement).toBeInTheDocument();
  });


  it('calls OnClick', async () => {

    const handleClick = vi.fn(); 
    
    render(<ButtonUi label="OnClick" styles="" onClick={handleClick} />);
    
    const buttonElement = screen.getByRole('button', { name: /onclick/i });
    
    await userEvent.click(buttonElement);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('apply styles', () => {
    const customStyle = 'bg-red-500 text-white';
    
    render(<ButtonUi label="Styles" styles={customStyle} />);
    
    const buttonElement = screen.getByRole('button', { name: /styles/i });
    
    expect(buttonElement).toHaveClass('bg-red-500');
    expect(buttonElement).toHaveClass('text-white');
    
    expect(buttonElement).toHaveClass('h-40px'); 
  });

  it('accept html attributes', () => {
 
    render(<ButtonUi label="Desabilitado" styles="" disabled={true} />);
    
    const buttonElement = screen.getByRole('button', { name: /desabilitado/i });
    
    expect(buttonElement).toBeDisabled();
  });
});