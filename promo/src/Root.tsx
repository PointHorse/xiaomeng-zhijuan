import React from 'react';
import { Composition } from 'remotion';
import { PromoSequence } from './Promo';
import { VIDEO, totalFrames } from './config';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="xiaomeng-promo"
    component={PromoSequence}
    durationInFrames={totalFrames}
    fps={VIDEO.fps}
    width={VIDEO.width}
    height={VIDEO.height}
  />
);
