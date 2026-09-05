/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { bootstrapMonitoring } from './src/core/monitoring/bootstrap';

// Sampling starts with the bundle, not with a screen: when the foreground
// service restarts the process there is no Activity, and nothing else would
// subscribe to telemetry or write to the database.
bootstrapMonitoring();

AppRegistry.registerComponent(appName, () => App);
