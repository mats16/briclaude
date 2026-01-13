import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarToggleButton({ isOpen, onToggle }: SidebarToggleButtonProps) {
  return (
    <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 shrink-0">
      {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
    </Button>
  );
}
