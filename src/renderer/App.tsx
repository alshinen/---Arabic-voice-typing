import { useState } from 'react';
import { Launcher } from './screens/Launcher';
import { TrainerGate } from './screens/TrainerGate';
import { TraineeHome } from './screens/TraineeHome';

type Platform = 'launcher' | 'trainer' | 'trainee';

export function App() {
  const [platform, setPlatform] = useState<Platform>('launcher');
  const back = () => setPlatform('launcher');

  switch (platform) {
    case 'launcher':
      return <Launcher onChoose={setPlatform} />;
    case 'trainer':
      return <TrainerGate onExit={back} />;
    case 'trainee':
      return <TraineeHome onExit={back} />;
  }
}
