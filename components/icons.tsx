import React from 'react';

export const CCIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5A2.25 2.25 0 0 1 6 2.25h12A2.25 2.25 0 0 1 20.25 4.5v15A2.25 2.25 0 0 1 18 21.75H6A2.25 2.25 0 0 1 3.75 19.5v-15Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 12.75h-.75a.375.375 0 0 1-.375-.375V11.25c0-.207.168-.375.375-.375h.75a2.25 2.25 0 0 1 2.25 2.25v.75a2.25 2.25 0 0 1-2.25 2.25h-.75a.375.375 0 0 1-.375-.375v-.75" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75h-.75a.375.375 0 0 1-.375-.375V11.25c0-.207.168-.375.375-.375h.75a2.25 2.25 0 0 1 2.25 2.25v.75a2.25 2.25 0 0 1-2.25 2.25h-.75a.375.375 0 0 1-.375-.375v-.75" />
  </svg>
);

export const SpeakerWaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
  </svg>
);

export const AdjustmentsHorizontalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
    </svg>
);

export const VideoCameraSolidIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-2.25l3.44 2.293a.75.75 0 0 0 1.21-.622V6.58a.75.75 0 0 0-1.21-.622L15.75 8.25V7.5a3 3 0 0 0-3-3H4.5Z" />
  </svg>
);

export const EllipsisHorizontalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M4.5 12a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm6 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z" clipRule="evenodd" />
  </svg>
);

export const XMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
  </svg>
);

export const MicrophoneIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.25a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Z" />
    <path d="M12.75 13.5a.75.75 0 0 0-1.5 0v2.625a3.375 3.375 0 0 0 6.75 0V13.5a.75.75 0 0 0-1.5 0v2.625a1.875 1.875 0 0 1-3.75 0V13.5Z" />
    <path d="M3.75 13.5a.75.75 0 0 0-1.5 0v2.625a3.375 3.375 0 0 0 6.75 0V13.5a.75.75 0 0 0-1.5 0v2.625a1.875 1.875 0 0 1-3.75 0V13.5Z" />
    <path d="M8.25 7.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V8.25a.75.75 0 0 1 .75-.75Z" />
    <path d="M15 7.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V8.25a.75.75 0 0 1 .75-.75Z" />
  </svg>
);

export const ServerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m15.56 0a2.25 2.25 0 0 1-2.25 2.25h-11.06a2.25 2.25 0 0 1-2.25-2.25m15.56 0v-1.5a2.25 2.25 0 0 0-2.25-2.25h-11.06a2.25 2.25 0 0 0-2.25 2.25v1.5" />
    </svg>
);