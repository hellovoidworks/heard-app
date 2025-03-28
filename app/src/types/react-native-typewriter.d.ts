declare module 'react-native-typewriter' {
  import { ReactNode } from 'react';
  import { TextProps } from 'react-native';

  interface TypeWriterProps extends TextProps {
    typing?: number; // 0 = stopped, 1 = typing, -1 = deleting
    maxDelay?: number;
    minDelay?: number;
    fixed?: boolean;
    initialDelay?: number;
    delayMap?: { [key: string]: number };
    onTyped?: (token: string, idx: number) => void;
    onTypingEnd?: () => void;
    onDeleted?: (token: string, idx: number) => void;
    onDeletingEnd?: () => void;
    children?: ReactNode;
  }

  export default function TypeWriter(props: TypeWriterProps): JSX.Element;
}
