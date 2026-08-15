declare module '*.html?raw' {
  const content: string;
  export default content;
}

declare module '*?worker' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module '*?worker&url' {
  const url: string;
  export default url;
}

declare module '*?url' {
  const url: string;
  export default url;
}
