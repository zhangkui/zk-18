import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, Tag, message, Popconfirm, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { sensorAPI, showcaseAPI } from '@/services/api';
import dayjs from 'dayjs';

const sensorTypeMap: Record<string, string> = {
  temperature: '温度',
  humidity: '湿度',
  light: '光照',
  vibration: '震动',
};

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: '正常', color: 'green' },
  inactive: { label: '已停用', color: 'red' },
};

const SensorManagement = () => {
  const [sensors, setSensors] = useState<any[]>([]);
  const [showcases, setShowcases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSensor, setEditingSensor] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  const fetchSensors = async () => {
    setLoading(true);
    try {
      const res = await sensorAPI.getAll();
      setSensors(res.data || []);
    } catch {
      message.error('获取传感器列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchShowcases = async () => {
    try {
      const res = await showcaseAPI.getAll();
      setShowcases(res.data || []);
    } catch {
      message.error('获取展柜列表失败');
    }
  };

  useEffect(() => {
    fetchSensors();
    fetchShowcases();
  }, []);

  const handleAdd = () => {
    setEditingSensor(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingSensor(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      showcase_id: record.showcase_id,
      sensor_type: record.sensor_type,
      unit: record.unit,
      min_threshold: record.min_threshold,
      max_threshold: record.max_threshold,
      warning_threshold: record.warning_threshold,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingSensor) {
        await sensorAPI.update(editingSensor.id, values);
        message.success('更新传感器成功');
      } else {
        await sensorAPI.create(values);
        message.success('创建传感器成功');
      }
      setModalVisible(false);
      fetchSensors();
    } catch {
      message.error(editingSensor ? '更新传感器失败' : '创建传感器失败');
    }
  };

  const handleToggleStatus = async (record: any) => {
    try {
      if (record.status === 'active') {
        await sensorAPI.disable(record.id);
        message.success('已停用');
      } else {
        await sensorAPI.enable(record.id);
        message.success('已启用');
      }
      fetchSensors();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await sensorAPI.delete(id);
      message.success('删除成功');
      fetchSensors();
    } catch {
      message.error('删除失败');
    }
  };

  const filteredSensors = sensors.filter((item) => {
    const matchSearch =
      !searchText ||
      item.code?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.name?.toLowerCase().includes(searchText.toLowerCase());
    const matchType = !filterType || item.sensor_type === filterType;
    const matchStatus = !filterStatus || item.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const getShowcaseName = (showcaseId: number) => {
    const showcase = showcases.find((s) => s.id === showcaseId);
    return showcase ? showcase.name : showcaseId;
  };

  const columns = [
    { title: '编号', dataIndex: 'code', key: 'code' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '所属展柜',
      dataIndex: 'showcase_id',
      key: 'showcase_id',
      render: (val: number) => getShowcaseName(val),
    },
    {
      title: '传感器类型',
      dataIndex: 'sensor_type',
      key: 'sensor_type',
      render: (val: string) => sensorTypeMap[val] || val,
    },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '最小阈值', dataIndex: 'min_threshold', key: 'min_threshold' },
    { title: '最大阈值', dataIndex: 'max_threshold', key: 'max_threshold' },
    { title: '预警阈值', dataIndex: 'warning_threshold', key: 'warning_threshold' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        const info = statusMap[val] || { label: val, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => handleToggleStatus(record)}>
            {record.status === 'active' ? '停用' : '启用'}
          </Button>
          <Popconfirm title="确定删除该传感器吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索编号/名称"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="传感器类型"
          value={filterType}
          onChange={setFilterType}
          allowClear
          style={{ width: 140 }}
          options={[
            { label: '温度', value: 'temperature' },
            { label: '湿度', value: 'humidity' },
            { label: '光照', value: 'light' },
            { label: '震动', value: 'vibration' },
          ]}
        />
        <Select
          placeholder="状态"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          style={{ width: 140 }}
          options={[
            { label: '正常', value: 'active' },
            { label: '已停用', value: 'inactive' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredSensors}
        loading={loading}
        pagination={{ defaultPageSize: 10, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title={editingSensor ? '编辑传感器' : '新增传感器'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编号" rules={[{ required: true, message: '请输入编号' }]}>
            <Input placeholder="请输入编号" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入名称" />
          </Form.Item>
          <Form.Item name="showcase_id" label="所属展柜" rules={[{ required: true, message: '请选择展柜' }]}>
            <Select
              placeholder="请选择展柜"
              options={showcases.map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
          <Form.Item name="sensor_type" label="传感器类型" rules={[{ required: true, message: '请选择传感器类型' }]}>
            <Select
              placeholder="请选择传感器类型"
              options={[
                { label: '温度', value: 'temperature' },
                { label: '湿度', value: 'humidity' },
                { label: '光照', value: 'light' },
                { label: '震动', value: 'vibration' },
              ]}
            />
          </Form.Item>
          <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请输入单位' }]}>
            <Input placeholder="请输入单位" />
          </Form.Item>
          <Form.Item name="min_threshold" label="最小阈值" rules={[{ required: true, message: '请输入最小阈值' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="请输入最小阈值" />
          </Form.Item>
          <Form.Item name="max_threshold" label="最大阈值" rules={[{ required: true, message: '请输入最大阈值' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="请输入最大阈值" />
          </Form.Item>
          <Form.Item name="warning_threshold" label="预警阈值" rules={[{ required: true, message: '请输入预警阈值' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="请输入预警阈值" />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              placeholder="请选择状态"
              options={[
                { label: '正常', value: 'active' },
                { label: '已停用', value: 'inactive' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default SensorManagement;
