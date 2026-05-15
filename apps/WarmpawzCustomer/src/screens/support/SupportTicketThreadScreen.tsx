/**
 * In-app thread for an escalated support ticket (polls GET /support/tickets/:id).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { SupportCrmApi } from '../../services/api';

type ThreadMsg = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export interface SupportTicketThreadScreenProps {
  ticketId: string;
  customerId?: string;
  onBack: () => void;
}

export function SupportTicketThreadScreen({
  ticketId,
  customerId,
  onBack,
}: SupportTicketThreadScreenProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState('');
  const [rows, setRows] = useState<ThreadMsg[]>([]);
  const [input, setInput] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapResponses = useCallback((responses: any[], initialMessage?: string, initialAt?: string) => {
    const out: ThreadMsg[] = [];
    if (initialMessage) {
      out.push({
        id: 'initial',
        role: 'customer',
        content: initialMessage,
        createdAt: initialAt || '',
      });
    }
    for (const r of responses || []) {
      out.push({
        id: String(r.id || r.created_at),
        role: String(r.responder_type || 'agent'),
        content: String(r.message || ''),
        createdAt: String(r.created_at || ''),
      });
    }
    return out;
  }, []);

  const load = useCallback(async () => {
    if (!ticketId?.trim()) return;
    try {
      const res: any = await SupportCrmApi.getTicket(ticketId);
      if (!res?.success || !res.ticket) {
        setRows([]);
        return;
      }
      const t = res.ticket;
      setSubject(t.subject || 'Support');
      setRows(mapResponses(res.responses, t.message, t.created_at));
    } catch (e) {
      console.warn('load ticket thread', e);
    } finally {
      setLoading(false);
    }
  }, [ticketId, mapResponses]);

  useEffect(() => {
    if (!ticketId?.trim()) {
      setLoading(false);
      return;
    }
    void load();
    pollRef.current = setInterval(() => {
      void load();
    }, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, ticketId]);

  const send = async () => {
    if (!ticketId?.trim()) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setInput('');
    try {
      await SupportCrmApi.respondToTicket(ticketId, {
        message: text,
        responderId: customerId,
        responderType: 'customer',
      });
      await load();
    } catch (e: any) {
      console.error('respondToTicket', e);
      Alert.alert('Could not send', 'Please try again in a moment.');
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: ThreadMsg }) => {
    const isSelf = item.role === 'customer';
    return (
      <View
        style={[
          styles.bubbleWrap,
          isSelf ? styles.bubbleWrapSelf : styles.bubbleWrapOther,
        ]}
      >
        <Text style={styles.meta}>
          {isSelf ? 'You' : item.role === 'agent' ? 'Support' : item.role}
        </Text>
        <View style={[styles.bubble, isSelf ? styles.bubbleSelf : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>{item.content}</Text>
        </View>
        {item.createdAt ? (
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        ) : null}
      </View>
    );
  };

  if (!ticketId?.trim()) {
    return (
      <ScreenShell style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support</Text>
          <View style={{ width: 56 }} />
        </View>
        <Text style={styles.subject}>Missing ticket. Open your request from the AI Assistant.</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={72}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Support request</Text>
          <View style={{ width: 56 }} />
        </View>
        <Text style={styles.subject} numberOfLines={2}>
          {subject}
        </Text>
        <Text style={styles.hint}>Ticket #{ticketId.slice(0, 8)}… — messages refresh every few seconds.</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
        <View style={styles.compose}>
          <TextInput
            style={styles.input}
            placeholder="Message support…"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={() => void send()}
            disabled={sending || !input.trim()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendLabel}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingVertical: 4 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  subject: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  bubbleWrap: { marginBottom: spacing.md, maxWidth: '92%' },
  bubbleWrapSelf: { alignSelf: 'flex-end' },
  bubbleWrapOther: { alignSelf: 'flex-start' },
  meta: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  bubble: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  bubbleSelf: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.backgroundSecondary },
  bubbleText: { color: colors.text, fontSize: 15 },
  bubbleTextSelf: { color: '#fff' },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  compose: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendLabel: { color: '#fff', fontWeight: '600' },
});
