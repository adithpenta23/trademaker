import { useCallback } from 'react';
import { backupFileName, buildBackup, serializeBackup, type BackupKind } from '../io/backup';
import { downloadText } from '../io/files';
import { navigate, paths } from '../state/router';
import { useStore } from '../state/store';
import { useFeedback } from '../ui/feedback';

export function useSessionActions() {
  const { state, actions } = useStore();
  const { toast, confirm } = useFeedback();
  const hasWork = state.quotes.length > 0 || state.changedSinceExport;

  const exportBackup = useCallback(
    (kind: Exclude<BackupKind, 'quote'> = 'full') => {
      const now = new Date();
      const file = buildBackup(kind, state, now);
      downloadText(serializeBackup(file), backupFileName(kind, state.business.name || 'trademaker', now));
      if (kind === 'full') actions.markExported();
      toast({
        message:
          kind === 'full'
            ? 'Backup downloaded. Keep the file somewhere safe — import it next time to continue.'
            : 'Quotes and templates exported.',
        tone: 'success',
      });
    },
    [state, actions, toast],
  );

  const loadDemo = useCallback(async () => {
    if (hasWork && !state.isSampleSession) {
      const ok = await confirm({
        title: 'Replace this session with demo data?',
        message: 'Loading the demo replaces your business profile, settings, quotes and templates in this session. Export a backup first if you want to keep them.',
        confirmLabel: 'Load demo',
        tone: 'danger',
      });
      if (!ok) return;
    }
    actions.loadDemo();
    navigate(paths.dashboard);
    toast({ message: 'Demo loaded: Evergreen Exterior Care (fictional sample data).', tone: 'success' });
  }, [hasWork, state.isSampleSession, confirm, actions, toast]);

  const clearSession = useCallback(async () => {
    const ok = await confirm({
      title: 'Clear the whole session?',
      message: 'This removes your business profile, settings, quotes and custom templates from this browser tab. It cannot be undone unless you have an exported backup.',
      confirmLabel: 'Clear session',
      tone: 'danger',
    });
    if (!ok) return;
    actions.clearSession();
    navigate(paths.dashboard);
    toast({ message: 'Session cleared.', tone: 'info' });
  }, [confirm, actions, toast]);

  return { exportBackup, loadDemo, clearSession };
}
