import { useState } from 'react';
import { api, embedded } from './api';
import { FeedbackProvider } from './components/ui';
import { Launcher } from './screens/Launcher';
import { TrainerGate } from './screens/TrainerGate';
import { TraineeApp } from './trainee/TraineeApp';

type Platform = 'launcher' | 'trainer' | 'trainee';

/**
 * منصتان منفصلتان (design.md 1.1). من متصفح جهاز آخر على الشبكة تظهر منصة المتدرب فقط،
 * ولا يمكن الوصول إلى منصة المدرب.
 */
export function App() {
  const [platform, setPlatform] = useState<Platform>(embedded ? 'launcher' : 'trainee');

  const choose = (p: Platform) => {
    // الانتقال إلى منصة المتدرب يُخرج المدرب حتى لا تبقى صلاحياته مفتوحة على الجهاز.
    if (p !== 'trainer' && embedded) void api.auth.logout();
    setPlatform(p);
  };

  return (
    <FeedbackProvider>
      {platform === 'launcher' && <Launcher onChoose={choose} />}
      {platform === 'trainer' && <TrainerGate onExit={() => choose('launcher')} />}
      {platform === 'trainee' && <TraineeApp onExit={embedded ? () => choose('launcher') : undefined} />}
    </FeedbackProvider>
  );
}
