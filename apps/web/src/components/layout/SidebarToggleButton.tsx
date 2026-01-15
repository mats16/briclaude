import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

export function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const isOpen = state === 'expanded';

  return (
    <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 shrink-0">
      {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
    </Button>
  );
}
