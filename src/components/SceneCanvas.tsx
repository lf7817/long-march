import { useEffect, useRef } from 'react';
import { Engine } from '../engine/Engine';
import { useApp } from '../store';

export default function SceneCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const engine = new Engine(ref.current!);
    useApp.setState({ engine });
    void engine.init();
    return () => {
      engine.dispose();
      useApp.setState({ engine: null, ready: false });
    };
  }, []);
  return <canvas id="scene" ref={ref} />;
}