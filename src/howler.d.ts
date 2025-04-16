declare module "howler" {
  export class Howl {
    constructor(options: {
      src: string[] | string;
      volume?: number;
      loop?: boolean;
      autoplay?: boolean;
      onend?: () => void;
      [key: string]: any;
    });
    play(id?: number | string): number;
    stop(id?: number | string): void;
    pause(id?: number | string): void;
    volume(vol?: number): number;
    // Add more methods as needed
  }
}
