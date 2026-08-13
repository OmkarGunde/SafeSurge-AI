import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 90000 });

export const getHealth = () => api.get('/health');
export const getLatestConditions = () => api.get('/conditions/latest');
export const getBiparjoyReplay = (timestep) => api.get(`/cyclone/biparjoy-replay?timestep=${timestep}`);
export const getBiparjoyFull = () => api.get('/cyclone/biparjoy-full');
export const getSettlements = () => api.get('/settlements');

export const interpretRisk = (data) => api.post('/agents/interpret-risk', data);
export const fishermenAlert = (data) => api.post('/agents/fishermen-alert', data);
export const evacuationPlan = (data) => api.post('/agents/evacuation-plan', data);
export const reliefCoordination = (data) => api.post('/agents/relief-coordination', data);
export const damageAssessment = (formData) => api.post('/agents/damage-assessment', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const runFullChain = (conditions) => api.post('/orchestrator/run-full-chain', { conditions });
export const getAgentLogs = () => api.get('/orchestrator/agent-logs');
