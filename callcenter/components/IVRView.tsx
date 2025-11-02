
import React from 'react';
import { FlowIcon } from './icons';

const IVRView: React.FC = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <FlowIcon className="w-24 h-24 text-eburon-fg/30 mb-4" />
            <h1 className="text-2xl font-bold text-eburon-fg/80">IVR Studio Removed</h1>
            <p className="text-eburon-fg/60 mt-2 max-w-md">
                This feature has been removed from the application to streamline the user experience.
            </p>
        </div>
    );
};

export default IVRView;
