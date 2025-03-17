import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { TabView, TabBar, SceneMap } from 'react-native-tab-view';
import { useTheme } from 'react-native-paper';
import CorrespondenceTab from './mailbox/CorrespondenceTab';
import MyLettersTab from './mailbox/MyLettersTab';

const initialLayout = { width: Dimensions.get('window').width };

const MailboxScreen = () => {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'correspondence', title: 'Correspondence' },
    { key: 'myLetters', title: 'My Letters' },
  ]);

  const renderScene = SceneMap({
    correspondence: CorrespondenceTab,
    myLetters: MyLettersTab,
  });

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      indicatorStyle={{ backgroundColor: theme.colors.primary }}
      style={{ backgroundColor: 'white' }}
      labelStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
    />
  );

  return (
    <View style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default MailboxScreen; 