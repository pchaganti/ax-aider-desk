import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import { HiPlus } from 'react-icons/hi';
import { clsx } from 'clsx';

import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { MultiSelect } from '@/components/common/MultiSelect';

type Props = {
  models: string[];
  onChange: (updatedModels: string[]) => void;
  placeholder?: string;
  availableModels?: string[];
};

export const ProviderModels = ({ models, onChange, placeholder, availableModels }: Props) => {
  const { t } = useTranslation();

  const [newModel, setNewModel] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const notSelectedModels = availableModels ? availableModels.filter((model) => !models.includes(model)) : [];

  const handleModelsChange = (updatedModels: string[]) => {
    onChange(updatedModels);
  };

  const handleRemoveModel = (index: number) => {
    const updatedModels = models.filter((_, i) => i !== index);
    handleModelsChange(updatedModels);
  };

  const handleAddModels = () => {
    if (selectedModels.length > 0) {
      // Add all selected models at once
      const updatedModels = [...models, ...selectedModels.filter((model) => !models.includes(model))];
      handleModelsChange(updatedModels);
      setSelectedModels([]);
    } else if (newModel.trim() && !models.includes(newModel.trim())) {
      handleModelsChange([...models, newModel.trim()]);
      setNewModel('');
    }
  };

  const selectOptions =
    notSelectedModels?.map((model) => ({
      value: model,
      label: model,
    })) || [];

  return (
    <div className="space-y-1">
      <div>
        <div className="text-sm font-medium mb-1">{t('model.labelMultiple')}</div>
        <div className={clsx('space-y-1', models.length && 'mb-2')}>
          {models.map((model, index) => (
            <div
              key={model}
              className="flex items-center justify-between rounded-md border border-border-default-dark bg-bg-secondary-light px-2 py-1.5 text-xs"
            >
              <span>{model}</span>
              <IconButton
                icon={<IoClose className="h-4 w-4" />}
                onClick={() => handleRemoveModel(index)}
                className="text-text-muted-light hover:text-text-secondary"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-end space-x-2">
        {availableModels !== undefined && availableModels.length > 0 ? (
          <MultiSelect
            className="flex-grow"
            options={selectOptions}
            selected={selectedModels}
            onChange={setSelectedModels}
            noneSelectedLabel={t('model.chooseModelsToAdd')}
            filterInput={true}
          />
        ) : (
          <Input
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder={placeholder || t('model.placeholder')}
            wrapperClassName="flex-grow"
          />
        )}
        <Button onClick={handleAddModels} disabled={!newModel.trim() && selectedModels.length === 0} variant="text">
          <HiPlus className="mr-1 w-3 h-3" />
          {t('common.add')}
        </Button>
      </div>
    </div>
  );
};
