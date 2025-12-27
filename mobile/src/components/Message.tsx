
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Message = ({ message }) => {
  const isSent = message.sent;
  return (
    <View style={[styles.messageRow, isSent ? styles.sentRow : styles.receivedRow]}>
      <View style={[styles.messageBubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
        <Text style={isSent ? styles.sentText : styles.receivedText}>{message.text}</Text>
        <Text style={styles.time}>{message.time}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageRow: {
    flexDirection: 'row',
    marginVertical: 5,
  },
  sentRow: {
    justifyContent: 'flex-end',
  },
  receivedRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    maxWidth: '70%',
  },
  sentBubble: {
    backgroundColor: '#8A2BE2',
  },
  receivedBubble: {
    backgroundColor: '#f0f0f0',
  },
  sentText: {
    color: '#fff',
    fontSize: 16,
  },
  receivedText: {
    color: '#000',
    fontSize: 16,
  },
  time: {
    color: '#ccc',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 5,
  },
});

export default Message;
