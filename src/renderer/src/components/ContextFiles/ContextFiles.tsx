import React, { useEffect, useMemo, useState } from 'react';
import { StaticTreeDataProvider, Tree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import { HiX } from 'react-icons/hi';
import './ContextFiles.css';

enum FileType {
  Editable = 'editable',
  ReadOnly = 'readOnly',
  Companion = 'companion',
}

interface File {
  path: string;
  type: FileType;
}

interface TreeItem {
  index: string;
  isFolder: boolean;
  children: string[];
  data: string;
  file?: File;
}

const createFileTree = (files: File[]) => {
  const tree: Record<string, TreeItem> = {
    root: { index: 'root', children: [], isFolder: true, data: 'Root' },
  };

  files.forEach((file) => {
    const pathParts = file.path.split('/');

    let currentNode = tree.root;
    pathParts.forEach((part, partIndex) => {
      const isLastPart = partIndex === pathParts.length - 1;
      const nodeId = pathParts.slice(0, partIndex + 1).join('-');

      if (!tree[nodeId]) {
        tree[nodeId] = {
          index: nodeId,
          children: [],
          data: part,
          isFolder: !isLastPart,
          file: isLastPart ? file : undefined,
        };
        if (!currentNode.children) {
          currentNode.children = [];
        }
        currentNode.children.push(nodeId);
      }

      if (isLastPart) {
        tree[nodeId].data = part;
        tree[nodeId].isFolder = false;
      }

      currentNode = tree[nodeId];
    });
  });

  return tree;
};

type Props = {
  baseDir: string;
};

export const ContextFiles = ({ baseDir }: Props) => {
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    const fileAddedListenerId = window.api.addFileAddedListener(baseDir, (_, data) => {
      setFiles((prev) => [
        ...new Set([
          ...prev,
          {
            path: data.path,
            type: data.readOnly ? FileType.ReadOnly : FileType.Editable,
          },
        ]),
      ]);
    });

    const fileDroppedListenerId = window.api.addFileDroppedListener(baseDir, (_, data) => {
      setFiles((prev) => prev.filter((file) => file.path !== data.path));
    });

    return () => {
      window.api.removeFileAddedListener(fileAddedListenerId);
      window.api.removeFileDroppedListener(fileDroppedListenerId);
    };
  }, [baseDir]);

  const treeData = useMemo(() => createFileTree(files.filter((f) => f.type === FileType.Editable)), [files]);

  const renderFileTree = (key: React.Key, id: string, title: string, treeData: Record<string, TreeItem>) => {
    return (
      <div className="flex flex-col">
        <h3 className="text-md font-semibold mb-2 uppercase">{title}</h3>
        <div className="flex-grow w-full">
          <UncontrolledTreeEnvironment
            key={key}
            dataProvider={
              new StaticTreeDataProvider(treeData, (item) => ({
                ...item,
                canMove: false,
                canRename: false,
              }))
            }
            getItemTitle={(item) => item.data}
            viewState={{
              [id]: {
                expandedItems: Object.keys(treeData),
              },
            }}
            renderItem={({ item, title, arrow, children }) => (
              <>
                <div className="flex items-center justify-between w-full pr-2">
                  <div className="flex items-center">
                    {arrow}
                    <span className={`ml-1 text-xxs ${item.isFolder ? 'text-neutral-400' : 'text-white'}`}>{title}</span>
                  </div>
                  {!item.isFolder && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="p-1 rounded hover:bg-neutral-900 text-neutral-500 hover:text-red-800"
                    >
                      <HiX className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {children}
              </>
            )}
            canDragAndDrop={false}
            canDropOnFolder={false}
            canReorderItems={false}
          >
            <Tree treeId={id} rootItem="root" />
          </UncontrolledTreeEnvironment>
        </div>
      </div>
    );
  };

  return <div className="flex-grow w-full p-2 space-y-4 overflow-auto">{renderFileTree(files.length, 'contextFiles', 'Context Files', treeData)}</div>;
};
