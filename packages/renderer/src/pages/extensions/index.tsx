import { Button, Card, Col, Row, Upload, Modal, Space, message, Typography, Spin, Form, Input, Checkbox, Divider, Dropdown, Select } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined, MoreOutlined, DeleteOutlined, SyncOutlined, ExclamationCircleFilled, SearchOutlined } from '@ant-design/icons';
import type { CheckboxProps, MenuProps, UploadProps } from 'antd';
import { ExtensionBridge, WindowBridge, GroupBridge } from '#preload';
import type { DB } from '../../../../shared/types/db';
import type { UploadFile } from 'antd/es/upload/interface';
import { debounce } from 'lodash';
import { containsKeyword } from '/@/utils/str';
import type { SearchProps } from 'antd/es/input';

const { Text } = Typography;
const { Meta } = Card;

const CheckboxGroup = Checkbox.Group;

const Extensions = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [extensions, setExtensions] = useState<DB.Extension[]>([]);
    const [messageApi, contextHolder] = message.useMessage({
        duration: 2,
        top: 120,
        getContainer: () => document.body,
    });
    const [uploadVisible, setUploadVisible] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [applyModalVisible, setApplyModalVisible] = useState(false);
    const [selectedExtension, setSelectedExtension] = useState<DB.Extension>();
    const [windows, setWindows] = useState<DB.Window[]>([]);
    const [selectedWindows, setSelectedWindows] = useState<number[]>([]);
    const [form] = Form.useForm();
    const currentIds = windows.map(w => w.id!);
    const currentSelectedCount = selectedWindows.filter(id => currentIds.includes(id)).length;
    const indeterminate = currentSelectedCount > 0 && currentSelectedCount < windows.length;
    const checkAll = windows.length > 0 && currentSelectedCount === windows.length;
    const [searchValue, setSearchValue] = useState('');
    const [groupOptions, setGroupOptions] = useState<DB.Group[]>([{ id: -1, name: 'All' }]);
    const [windowDataCopy, setWindowDataCopy] = useState<DB.Window[]>([]);

    const moreActionItems: MenuProps['items'] = [
        {
            key: 'update',
            label: t('extension_update'),
            icon: <SyncOutlined />,
        },
        {
            type: 'divider',
        },
        {
            key: 'delete',
            danger: true,
            label: t('extension_delete'),
            icon: <DeleteOutlined />,
        },
    ];

    const onChange = (list: number[]) => {
        const currentIds = windows.map(w => w.id!);
        // 保留不在当前视图的选中项
        setSelectedWindows(prev => [
            ...prev.filter(id => !currentIds.includes(id)),
            ...list
        ]);
    };

    const onCheckAllChange: CheckboxProps['onChange'] = (e) => {
        const currentIds = windows.map(w => w.id!);
        if (e.target.checked) {
            // 当全选时，保留不在当前视图的选中项，并添加当前视图的所有项
            setSelectedWindows(prev => [
                ...prev.filter(id => !currentIds.includes(id)),
                ...currentIds
            ]);
        } else {
            // 当取消全选时，只移除当前视图的选中项
            setSelectedWindows(prev => 
                prev.filter(id => !currentIds.includes(id))
            );
        }
    };

    const handleExtensionAction = async (key: string, extension: DB.Extension) => {
        switch (key) {
            case 'update':
                setUploadVisible(true);
                setSelectedExtension(extension);
                form.setFieldsValue({
                    id: extension.id,
                    path: extension.path,
                    version: extension.version,
                    name: extension.name,
                    description: extension.description,
                });

                break;
            case 'delete':
                Modal.confirm({
                    title: t('extension_delete_confirm_title'),
                    icon: <ExclamationCircleFilled />,
                    content: t('extension_delete_confirm_content'),
                    okText: t('footer_ok'),
                    cancelText: t('footer_cancel'),
                    onOk: async () => {
                        try {
                            const result = await ExtensionBridge.deleteExtension(extension.id!);
                            if (result instanceof Object && !result?.success) {
                                messageApi.error(result.message);
                            } else {
                                await fetchExtensions();
                                messageApi.success(t('extension_delete_success'));
                            }
                        } catch (error) {
                            messageApi.error(t('extension_delete_failed'));
                        }
                    },
                });
                break;
        }
    };

    const fetchExtensions = async () => {
        setLoading(true);
        try {
            const data = await ExtensionBridge.getAll();
            console.log(data);
            setExtensions(data);
        } catch (error) {
            messageApi.error('获取扩展列表失败');
        }
        setLoading(false);
    };

    const fetchExtensionWindows = async (extensionId: number) => {
        const data = await ExtensionBridge.getExtensionWindows(extensionId);
        setSelectedWindows(data.map((w: DB.WindowExtension) => w.window_id));
    };

    const handleApplyToWindow = async () => {
        if (!selectedExtension || !selectedWindows) return;

        try {
            await ExtensionBridge.syncWindowExtensions(selectedExtension.id!, selectedWindows);
            messageApi.success('应用成功');
        } catch (error) {
            messageApi.error('应用失败');
        }
        setApplyModalVisible(false);
    };

    const handleUploadExtension = async (extension: DB.Extension) => {
        console.log(extension);
        if (!extension.name || !extension.path) {
            if (!extension.name) {
                messageApi.error('请填写扩展名称');
            }
            if (!extension.path) {
                messageApi.error('请上传扩展安装包');
            }
            return;
        }
        if (selectedExtension) {
            try {
                await ExtensionBridge.updateExtension(selectedExtension.id!, extension);
                messageApi.success('更新成功');
                handleModalClose();
                fetchExtensions();
            } catch (error) {
                messageApi.error('更新失败');
            }
        } else {
            try {
                await ExtensionBridge.createExtension(extension);
                messageApi.success('上传成功');
                handleModalClose();
                fetchExtensions();
            } catch (error) {
                messageApi.error('上传失败');
            }
        }
    };

    const fetchWindows = async () => {
        const data = await WindowBridge.getAll();
        setWindows(data);
        setWindowDataCopy(data);
    };

    const fetchGroupData = async () => {
        const data = await GroupBridge?.getAll();
        data.splice(0, 0, { id: -1, name: 'All' });
        setGroupOptions(data);
    };

    const handleGroupChange = (value: number) => {
        if (value > -1) {
            const filteredWindows = [...windowDataCopy].filter(
                f => f.group_id === value,
            );
            setWindows(filteredWindows);
            // 保持已选中但不在当前视图的窗口ID
            setSelectedWindows(prev => {
                const filteredIds = filteredWindows.map(w => w.id!);
                return [
                    ...prev.filter(id => !windowDataCopy.find(w => w.id === id)?.group_id ||
                        windowDataCopy.find(w => w.id === id)?.group_id !== value),
                    ...prev.filter(id => filteredIds.includes(id))
                ];
            });
        } else {
            setWindows(windowDataCopy);
        }
    };

    const onSearch: SearchProps['onSearch'] = (value: string) => {
        if (value) {
            const keyword = value.toLowerCase();
            const filteredWindows = [...windowDataCopy].filter(
                f =>
                    containsKeyword(f.group_name, keyword) ||
                    containsKeyword(f.name, keyword) ||
                    containsKeyword(f.id, keyword)
            );
            setWindows(filteredWindows);
            // 保持已选中但不在当前视图的窗口ID
            setSelectedWindows(prev => {
                const filteredIds = filteredWindows.map(w => w.id!);
                return [
                    ...prev.filter(id => !filteredIds.includes(id)),
                    ...prev.filter(id => filteredIds.includes(id))
                ];
            });
        } else {
            setWindows(windowDataCopy);
        }
    };

    const debounceSearch = debounce(value => {
        onSearch(value);
    }, 500);

    const handleSearchValueChange = (value: string) => {
        setSearchValue(value.trim());
        debounceSearch(value.trim());
    };

    useEffect(() => {
        fetchWindows();
        fetchExtensions();
        fetchGroupData();
    }, []);

    const UploadForm = () => {
        const [fileList, setFileList] = useState<UploadFile[]>([]);

        const uploadProps: UploadProps = {
            name: 'extension',
            showUploadList: false,
            fileList,
            onChange: ({ fileList: newFileList }) => {
                console.log(newFileList);
                setFileList(newFileList);
            },
            accept: '.zip',
            customRequest: async ({ file, onSuccess, onError }) => {
                try {
                    console.log(file);
                    setUploading(true);
                    const result = await ExtensionBridge.uploadPackage((file as File).path, selectedExtension?.id);
                    console.log(result);
                    if (result.success) {
                        form.setFieldsValue({
                            id: result.extensionId,
                            path: result.path,
                            version: result.version,
                        });
                        onSuccess?.(file);
                    } else {
                        onError?.(new Error(result.error));
                        messageApi.error('上传失败: ' + result.error);
                    }
                } catch (error) {
                    messageApi.error('上传失败');
                }
                setUploading(false);
            },
        };

        // const iconUploadProps: UploadProps = {
        //     name: 'icon',
        //     showUploadList: false,
        //     accept: '.jpg,.jpeg,.png',
        //     beforeUpload: (file) => {
        //         const isImage = /\.(jpg|jpeg|png)$/.test(file.name);
        //         if (!isImage) {
        //             message.error(t('extension_icon_format_error'));
        //             return false;
        //         }
        //         if (file.size > 1024 * 1024) {
        //             message.error(t('extension_icon_size_error'));
        //             return false;
        //         }

        //         const reader = new FileReader();
        //         reader.onload = () => {
        //             setIconUrl(reader.result as string);
        //         };
        //         reader.readAsDataURL(file as Blob);
        //         return true;
        //     }
        // };

        return (
            <Form
                form={form}
                layout="vertical"
                size="large"
                onFinish={handleUploadExtension}
                initialValues={{
                    id: '',
                    path: '',
                    name: '',
                    version: '',
                    description: '',
                }}
                requiredMark="optional"
            >
                <Form.Item name="id" hidden>
                    <Input />
                </Form.Item>
                <Form.Item name="path" hidden>
                    <Input />
                </Form.Item>
                <Form.Item name="version" hidden>
                    <Input />
                </Form.Item>


                {/* <Form.Item
                    label={t('extension_icon')}
                    tooltip={t('extension_icon_tooltip')}
                >
                    <Upload {...iconUploadProps}>
                        <div className="w-[120px] h-[120px] border-2 border-dashed border-gray-200 rounded flex items-center justify-center cursor-pointer hover:border-blue-400">
                            {iconUrl ? (
                                <img src={iconUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center">
                                    <CloudUploadOutlined className="text-2xl" />
                                    <div>{t('extension_icon_upload_placeholder')}</div>
                                </div>
                            )}
                        </div>
                    </Upload>
                </Form.Item> */}

                <Form.Item
                    label={t('extension_name')}
                    name="name"
                    required
                    rules={[{ required: true, message: t('extension_name_required') }]}
                >
                    <Input maxLength={20} showCount placeholder={t('extension_name_placeholder')} />
                </Form.Item>

                <Form.Item
                    label={t('extension_description')}
                    name="description"
                    tooltip={t('extension_description_tooltip')}
                >
                    <Input.TextArea
                        maxLength={200}
                        showCount
                        placeholder={t('extension_description_placeholder')}
                        rows={4}
                    />
                </Form.Item>

                {form.getFieldValue('id') && !selectedExtension ? <div>
                    <div className="mb-4">{t('extension_install_package')}</div>
                    <div className="flex items-center gap-2">

                        <div className="flex items-center gap-2">
                            <span>
                                <CheckCircleOutlined className="text-green-500" />
                            </span>
                            {
                                fileList.map(file => (
                                    <span key={file.uid} className="text-sm text-gray-500">{file.name}</span>
                                ))
                            }
                            <span>{t('extension_upload_success')}</span>
                        </div>

                        <span className="cursor-pointer ml-2" onClick={() => {
                            form.setFieldsValue({ id: '', path: '' });
                            setFileList([]);
                        }}>
                            <CloseCircleOutlined className="text-red-500" />
                        </span>
                    </div>
                </div> : <Form.Item
                    label={t('extension_install_package')}
                    required
                    tooltip={t('extension_install_package_tooltip')}
                >
                    <Upload.Dragger  {...uploadProps}>
                        <CloudUploadOutlined className="text-2xl" />
                        <div className="mt-2">{t('extension_upload2')}</div>
                        <div className="text-gray-400 text-sm">
                            {t('extension_zip_format_tip')}
                        </div>
                    </Upload.Dragger>
                    {
                        uploading && <div className="text-gray-400 text-sm mt-2">{t('extension_uploading')}</div>
                    }
                    {
                        selectedExtension && <div className="text-gray-400 text-sm mt-2">
                            {t('extension_current_version')}: {selectedExtension.version}
                        </div>
                    }
                </Form.Item>}

                <Form.Item className="mb-0">
                    <Space className="w-full justify-end">
                        <Button type="text" className="w-20" size='middle' onClick={() => setUploadVisible(false)}>{t('footer_cancel')}</Button>
                        <Button type="primary" className="w-20" size='middle' onClick={() => form.submit()}>{t('footer_ok')}</Button>
                    </Space>
                </Form.Item>

            </Form>
        );
    };

    const handleModalClose = () => {
        form.resetFields();
        setUploadVisible(false);
        setSelectedExtension(undefined);
    };

    return (
        <>
            {contextHolder}
            <div className="content-toolbar">
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                        setSelectedExtension(undefined);
                        setUploadVisible(true);
                    }}
                >
                    {t('extension_upload')}
                </Button>
            </div>

            <Row gutter={[16, 16]} className="mt-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                {loading ? <Spin /> : (
                    extensions.map(ext => (
                        <Col span={6} key={ext.id}>
                            <Card
                                hoverable
                                title={ext.name}
                                cover={ext.icon && <img alt={ext.name} src={ext.icon} />}
                                extra={
                                    <Dropdown
                                        menu={{
                                            items: moreActionItems,
                                            onClick: ({ key }) => handleExtensionAction(key, ext),
                                        }}
                                        trigger={['hover']}
                                        placement="bottomRight"
                                    >
                                        <MoreOutlined className="cursor-pointer text-lg" />
                                    </Dropdown>
                                }
                                actions={[
                                    <Button
                                        type="link"
                                        onClick={() => {
                                            setSelectedExtension(ext);
                                            fetchExtensionWindows(ext.id!);
                                            setApplyModalVisible(true);
                                        }}
                                    >
                                        {t('extension_apply_to_window')}
                                    </Button>
                                ]}
                            >
                                <Meta
                                    description={
                                        <Space direction="vertical">
                                            <Text type="secondary">ID: {ext.id}</Text>
                                            <Text type="secondary">{t('extension_version')}: {ext.version}</Text>
                                            <Text type="secondary">{t('extension_update_time')}: {ext.updated_at}</Text>
                                        </Space>
                                    }
                                />
                            </Card>
                        </Col>
                    ))
                )}
            </Row>

            <Modal
                title={<div className="text-xl font-bold">{selectedExtension ? t('extension_update2') : t('extension_upload2')}</div>}
                open={uploadVisible}
                onCancel={handleModalClose}
                footer={null}
                width={640}
            >
                <UploadForm />
            </Modal>

            <Modal
                title={<div className="text-xl font-bold">{t('extension_apply_to_window')}</div>}
                open={applyModalVisible}
                onOk={handleApplyToWindow}
                onCancel={() => setApplyModalVisible(false)}
            >
                <div className="p-4">
                    <div className="flex items-center mb-4 justify-between">
                        <Checkbox
                            indeterminate={indeterminate}
                            onChange={onCheckAllChange}
                            checked={checkAll}
                            className="text-base font-medium"
                        >
                            {t('extension_select_all')}
                        </Checkbox>

                        <Space size={16}>
                            <Select
                                defaultValue={-1}
                                defaultActiveFirstOption={true}
                                style={{ width: 120 }}
                                fieldNames={{ value: 'id', label: 'name' }}
                                onChange={handleGroupChange}
                                options={groupOptions}
                            />
                            <Input
                                value={searchValue}
                                className="w-[200px]"
                                placeholder={t('search_window')}
                                onChange={e => handleSearchValueChange(e.target.value)}
                                prefix={<SearchOutlined />}
                            />
                        </Space>
                    </div>
                    <Divider className="my-2" />

                    <div className="max-h-[400px] overflow-y-auto pr-2">
                        <CheckboxGroup value={selectedWindows} onChange={onChange}>
                            <Row gutter={[16, 8]}>
                                <Col span={12}>
                                    {windows
                                        .filter((_, index) => index % 2 === 0)
                                        .map(w => (
                                            <div
                                                key={w.id}
                                                className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                                            >
                                                <Checkbox value={w.id}>
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className="text-gray-400">#{w.id}</span>
                                                        <span className="font-medium">{w.name}</span>
                                                        {w.group_name && (
                                                            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded whitespace-nowrap">
                                                                {w.group_name}
                                                            </span>
                                                        )}
                                                    </span>
                                                </Checkbox>
                                            </div>
                                        ))
                                    }
                                </Col>
                                <Col span={12}>
                                    {windows
                                        .filter((_, index) => index % 2 !== 0)
                                        .map(w => (
                                            <div
                                                key={w.id}
                                                className="p-2 hover:bg-gray-50 rounded-md transition-colors"
                                            >
                                                <Checkbox value={w.id}>
                                                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                                                        <span className="text-gray-400">#{w.id}</span>
                                                        <span className="font-medium">{w.name}</span>
                                                        {w.group_name && (
                                                            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded whitespace-nowrap">
                                                                {w.group_name}
                                                            </span>
                                                        )}
                                                    </span>
                                                </Checkbox>
                                            </div>
                                        ))
                                    }
                                </Col>
                            </Row>
                        </CheckboxGroup>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default Extensions;
