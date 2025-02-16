import React, { useState, useRef } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Divider, Input, Select, Space, Button, Tag, Row, Col, Typography } from 'antd';
import type { InputRef } from 'antd';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import './index.css';
import type { DB } from '../../../../shared/types/db';
import { DeleteOutlined } from '@ant-design/icons';
interface AddableSelectOptions {
  options: DB.Group[] | DB.Tag[];
  value?: number | string[] | number[] | undefined | string;
  mode?: 'tags' | 'multiple' | undefined;
  onChange?: (value: number | string[] | number[] | string, options: DB.Group | DB.Group[]) => void;
  onClear?: () => void;
  onAddItem: (name: string) => Promise<boolean>;
  addBtnLabel?: string;
  placeholder?: string;
  onRemoveItem?: (value: number | string) => void;
}

const AddableSelect: React.FC<AddableSelectOptions> = ({
  options,
  value,
  mode,
  onChange,
  onClear,
  onAddItem,
  addBtnLabel,
  placeholder,
  onRemoveItem,
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<InputRef>(null);
  const fieldNames = { label: 'name', value: 'id' };
  const { Text } = Typography;
  const onNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const addItem = async (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    if (name.trim()) {
      await triggerAddItem(name);
    }
  };

  const triggerAddItem = async (name: string) => {
    const addResult = await onAddItem(name);
    if (addResult) {
      setName('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const tagRender = (props: CustomTagProps) => {
    const { label, value, closable, onClose } = props;
    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const tag = (options as DB.Tag[]).find(item => item.id === value);
    const color = tag?.color;
    return (
      <Tag
        color={color}
        onMouseDown={onPreventMouseDown}
        closable={closable}
        bordered={false}
        onClose={onClose}
        style={{ marginRight: 3 }}
      >
        {label}
      </Tag>
    );
  };

  const filterOption = (input: string, option?: DB.Group | DB.Tag) => {
    return (option?.name ?? '').toLowerCase().includes(input.toLowerCase());
  };

  return (
    <Select
      showSearch
      mode={mode}
      value={value}
      filterOption={filterOption}
      allowClear
      onClear={onClear}
      tagRender={tagRender}
      placeholder={placeholder || ''}
      // labelInValue={true}
      onChange={onChange}
      tokenSeparators={[',']}
      fieldNames={fieldNames}
      dropdownRender={menu => (
        <>
          {menu}
          <Divider style={{ margin: '8px 0' }} />
          <Space style={{ padding: '0 8px 4px' }}>
            <Input
              placeholder="Please enter item"
              ref={inputRef}
              value={name}
              onChange={onNameChange}
              onKeyDown={async e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  await triggerAddItem(name);
                }
              }}
            />
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={addItem}
            >
              {addBtnLabel || 'Add item'}
            </Button>
          </Space>
        </>
      )}
      options={options}
      optionRender={option => {
        return (
          <Row justify="space-between">
            <Col span={21}>
              <Text ellipsis>{option.label}</Text>
            </Col>
            <Col span={3} title="Remove">
              <span
                onClick={e => {
                  e.stopPropagation();
                  onRemoveItem?.(option.value);
                }}
                className="cursor-pointer p-1 border rounded-lg bg-red-200 text-red-500"
              >
                <DeleteOutlined />
              </span>
            </Col>
          </Row>
        );
      }}
    />
  );
};

export default AddableSelect;
