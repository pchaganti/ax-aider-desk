import { ProjectData } from '@common/types';
import { useEffect, useRef, useState } from 'react';
import { Tab, TabGroup, TabList } from '@headlessui/react';
import clsx from 'clsx';
import { MdAdd, MdClose, MdChevronLeft, MdChevronRight } from 'react-icons/md';

type Props = {
  openProjects: ProjectData[];
  activeProject: ProjectData | undefined;
  onAddProject: () => void;
  onSetActiveProject: (baseDir: string) => void;
  onCloseProject: (projectBaseDir: string) => void;
};

export const ProjectTabs = ({ openProjects, activeProject, onAddProject, onSetActiveProject, onCloseProject }: Props) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScrollButton, setShowLeftScrollButton] = useState(false);
  const [showRightScrollButton, setShowRightScrollButton] = useState(false);

  const checkScrollButtonsVisibility = () => {
    const container = tabsContainerRef.current;
    if (container) {
      const { scrollWidth, clientWidth, scrollLeft } = container;
      setShowLeftScrollButton(scrollLeft > 0);
      setShowRightScrollButton(scrollLeft + clientWidth < scrollWidth);
    }
  };

  const handleScroll = () => {
    checkScrollButtonsVisibility();
  };

  const handleScrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    checkScrollButtonsVisibility();

    const container = tabsContainerRef.current;
    if (!container) {
      return;
    }
    const resizeObserver = new ResizeObserver(checkScrollButtonsVisibility);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [openProjects, activeProject]);

  return (
    <TabGroup
      className="overflow-x-hidden flex-1"
      selectedIndex={openProjects.findIndex((p) => p.baseDir === activeProject?.baseDir)}
      onChange={(index) => onSetActiveProject(openProjects[index].baseDir)}
    >
      <TabList className="flex items-center relative">
        {showLeftScrollButton && (
          <button
            className="absolute left-0 z-10 h-full flex items-center px-2 bg-neutral-900/80 hover:bg-neutral-900 transition-colors duration-200"
            onClick={handleScrollLeft}
          >
            <MdChevronLeft className="h-5 w-5 text-neutral-400" />
          </button>
        )}
        <div ref={tabsContainerRef} className="flex items-center overflow-x-hidden scroll-smooth" onScroll={handleScroll}>
          {openProjects.map((project) => (
            <Tab
              key={project.baseDir}
              className={({ selected }) =>
                clsx(
                  'text-sm pl-3 py-2 pr-1 border-r border-neutral-800 transition-all duration-200 ease-in-out flex items-center gap-3 relative whitespace-nowrap',
                  selected
                    ? 'bg-gradient-to-b from-neutral-800 to-neutral-800 text-neutral-100 font-medium'
                    : 'bg-gradient-to-b from-neutral-950 to-neutral-900 text-neutral-600 hover:bg-neutral-800/50 hover:text-neutral-300',
                )
              }
            >
              {project.baseDir.split(/[\\/]/).pop()}
              <div
                className={clsx(
                  'flex items-center justify-center rounded-full p-1 transition-colors duration-200',
                  activeProject?.baseDir === project.baseDir ? 'hover:bg-neutral-500/30' : 'hover:bg-neutral-600/30',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseProject(project.baseDir);
                }}
              >
                <MdClose className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </Tab>
          ))}
        </div>
        {showRightScrollButton && (
          <button
            className="absolute right-[52px] z-10 h-full flex items-center px-2 bg-neutral-900/80 hover:bg-neutral-900 transition-colors duration-200"
            onClick={handleScrollRight}
          >
            <MdChevronRight className="h-5 w-5 text-neutral-400" />
          </button>
        )}
        <button
          className="px-4 py-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/30 transition-colors duration-200 flex items-center justify-center"
          onClick={onAddProject}
        >
          <MdAdd className="h-5 w-5" />
        </button>
      </TabList>
    </TabGroup>
  );
};
