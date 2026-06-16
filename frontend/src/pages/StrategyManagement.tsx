import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, message, Popconfirm, Card, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { interventionAPI } from '@/services/api';
import dayjs from 'dayjs';

const severityMap: Record<string, { label: string; color: string }> = {
  low: { label: '低', color: 'green' },
  medium: { label: '中', color: 'orange' },
  high: { label: '高', color: 'red' },
};

const sensorTypeMap: Record<string, string> = {
  temperature: '温度',
  humidity: '湿度',
  light: '光照',
  vibration: '震动',
};

const StrategyManagement = () => {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [searchText, setSearchText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const res = await interventionAPI.getStrategies();
      setStrategies(res.data || []);
    } catch {
      message.error('获取策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      applicable_sensor_types: record.applicable_sensor_types || [],
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await interventionAPI.deleteStrategy(id);
      message.success('删除成功');
      fetchStrategies();
    } catch {
      message.error('删除失败');
    }
  };

  const handleToggleActive = async (record: any) => {
    try {
      if (record.is_active) {
        await interventionAPI.disableStrategy(record.id);
        message.success('已禁用');
      } else {
        await interventionAPI.enableStrategy(record.id);
        message.success('已启用');
      }
      fetchStrategies();
    } catch {
      message.error('状态切换失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await interventionAPI.updateStrategy(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await interventionAPI.createStrategy(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchStrategies();
    } catch {
      message.error('操作失败');
    }
  };

  const filteredStrategies = strategies.filter((item) => {
    const matchSearch =
      !searchText ||
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchText.toLowerCase());
    const matchSeverity = !severityFilter || item.severity_level === severityFilter;
    const matchActive =
      activeFilter === undefined ||
      activeFilter === '' ||
      (activeFilter === 'true' && item.is_active) ||
      (activeFilter === 'false' && !item.is_active);
    return matchSearch && matchSeverity && matchActive;
  });

  const columns = [
    { title: '策略编号', dataIndex: 'code', key: 'code' },
    { title: '策略名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '触发条件', dataIndex: 'trigger_condition', key: 'trigger_condition', ellipsis: true },
    {
      title: '适用类型',
      dataIndex: 'applicable_sensor_types',
      key: 'applicable_sensor_types',
      render: (types: string[]) =>
        (types || []).map((t) => (
          <Tag key={t}>{sensorTypeMap[t] || t}</Tag>
        )),
    },
    {
      title: '严重级别',
      dataIndex: 'severity_level',
      key: 'severity_level',
      render: (level: string) => {
        const info = severityMap[level];
        return info ? <Tag color={info.color}>{info.label}</Tag> : level;
      },
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean, record: any) => (
        <Switch checked={active} onChange={() => handleToggleActive(record)} />
      ),
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
          <Popconfirm title="确定删除该策略吗？" onConfirm={() => handleDelete(record.id)}>
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
          placeholder="搜索策略名称/编号"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="严重级别"
          value={severityFilter}
          onChange={setSeverityFilter}
          style={{ width: 120 }}
          allowClear
        >
          <Select.Option value="low">低</Select.Option>
          <Select.Option value="medium">中</Select.Option>
          <Select.Option value="high">高</Select.Option>
        </Select>
        <Select
          placeholder="启用状态"
          value={activeFilter}
          onChange={setActiveFilter}
          style={{ width: 120 }}
          allowClear
        >
          <Select.Option value="true">已启用</Select.Option>
          <Select.Option value="false">已禁用</Select.Option>
        </Select>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增策略
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={filteredStrategies}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
      />

      <Modal
        title={editingRecord ? '编辑策略' : '新增策略'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true, message: '请输入策略名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="策略编号" rules={[{ required: true, message: '请输入策略编号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="trigger_condition" label="触发条件" rules={[{ required: true, message: '请输入触发条件' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="action_steps" label="干预步骤">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="applicable_sensor_types" label="适用传感器类型" rules={[{ required: true, message: '请选择传感器类型' }]}>
            <Select mode="multiple" placeholder="请选择传感器类型">
              <Select.Option value="temperature">温度</Select.Option>
              <Select.Option value="humidity">湿度</Select.Option>
              <Select.Option value="light">光照</Select.Option>
              <Select.Option value="vibration">震动</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="severity_level" label="严重级别" rules={[{ required: true, message: '请选择严重级别' }]}>
            <Select placeholder="请选择严重级别">
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="启用状态" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default StrategyManagement;
