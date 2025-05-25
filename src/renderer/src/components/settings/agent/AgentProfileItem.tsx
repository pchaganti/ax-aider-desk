import { AgentProfile } from '@common/types';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

type Props = {
  profile: AgentProfile;
  isSelected: boolean;
  onClick: (id: string) => void;
  isDefault: boolean;
};

export const AgentProfileItem = ({ profile, isSelected, onClick, isDefault }: Props) => {
  const { t } = useTranslation();

  const handleClick = () => {
    onClick(profile.id);
  };

  return (
    <div
      className={clsx(
        'w-full rounded-sm justify-start mb-0.5 truncate text-left h-auto py-1 px-2 text-sm cursor-pointer',
        'transition-colors duration-200 ease-in-out',
        isSelected ? 'bg-neutral-800 text-white' : 'hover:bg-neutral-700/50 text-neutral-300',
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {profile.name}&nbsp;
      {isDefault && <span className="ml-1.5 text-xs text-neutral-400">({t('common.default')})</span>}
    </div>
  );
};
