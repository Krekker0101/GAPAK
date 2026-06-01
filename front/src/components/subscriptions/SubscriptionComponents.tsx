import React, { useState } from 'react';
import { Heart, Bell, Settings, CheckCircle2, Clock } from 'lucide-react';

/**
 * SubscribeButton Component
 * Кнопка для подписки/отписки на пользователя
 * Поддерживает VISIBLE и SILENT типы подписок
 */
interface SubscribeButtonProps {
  creatorId: string;
  isSubscribed?: boolean;
  subscriptionType?: 'VISIBLE' | 'SILENT';
  onSubscribe?: (type: 'VISIBLE' | 'SILENT') => void;
  onUnsubscribe?: () => void;
  isPrivateAccount?: boolean;
  className?: string;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  creatorId,
  isSubscribed = false,
  subscriptionType = 'VISIBLE',
  onSubscribe,
  onUnsubscribe,
  isPrivateAccount = false,
  className = '',
}) => {
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (type: 'VISIBLE' | 'SILENT') => {
    setIsLoading(true);
    try {
      if (onSubscribe) {
        onSubscribe(type);
      }
    } finally {
      setIsLoading(false);
      setShowTypeMenu(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsLoading(false);
    if (onUnsubscribe) {
      onUnsubscribe();
    }
  };

  if (isSubscribed) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={handleUnsubscribe}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <CheckCircle2 size={18} />
          <span>Подписан</span>
        </button>
        
        <div className="relative">
          <button
            onClick={() => setShowTypeMenu(!showTypeMenu)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={subscriptionType === 'VISIBLE' ? 'Заметная подписка' : 'Тихая подписка'}
          >
            {subscriptionType === 'VISIBLE' ? (
              <Bell size={20} className="text-blue-500" />
            ) : (
              <Bell size={20} className="text-gray-400 line-through" />
            )}
          </button>

          {showTypeMenu && (
            <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg z-10 min-w-max">
              <button
                onClick={() => handleSubscribe('VISIBLE')}
                className="block w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors first:rounded-t-lg border-b"
              >
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-blue-500" />
                  <div>
                    <div className="font-medium">🔔 Заметная</div>
                    <div className="text-xs text-gray-500">Получай уведомления</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleSubscribe('SILENT')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors last:rounded-b-lg"
              >
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-gray-400 line-through" />
                  <div>
                    <div className="font-medium">🔇 Тихая</div>
                    <div className="text-xs text-gray-500">Без уведомлений</div>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowTypeMenu(!showTypeMenu)}
        disabled={isLoading}
        className="w-full px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {isPrivateAccount ? 'Запросить подписку' : 'Подписаться'}
      </button>

      {showTypeMenu && !isPrivateAccount && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-10">
          <button
            onClick={() => handleSubscribe('VISIBLE')}
            className="block w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors first:rounded-t-lg border-b font-medium"
          >
            <div className="flex items-center gap-3">
              <div className="text-lg">🔔</div>
              <div>
                <div className="font-semibold text-gray-800">Заметная подписка</div>
                <div className="text-sm text-gray-500">Видишь новости и получаешь уведомления</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => handleSubscribe('SILENT')}
            className="block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors last:rounded-b-lg font-medium"
          >
            <div className="flex items-center gap-3">
              <div className="text-lg">🔇</div>
              <div>
                <div className="font-semibold text-gray-800">Тихая подписка</div>
                <div className="text-sm text-gray-500">Видишь контент, но без уведомлений</div>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * AccountTypeSelector Component
 * Выбор типа аккаунта: PERSONAL или CHANNEL
 */
interface AccountTypeSelectorProps {
  value: 'PERSONAL' | 'CHANNEL';
  onChange: (type: 'PERSONAL' | 'CHANNEL') => void;
  className?: string;
}

export const AccountTypeSelector: React.FC<AccountTypeSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800">Выбери тип аккаунта</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal Account */}
        <div
          onClick={() => onChange('PERSONAL')}
          className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
            value === 'PERSONAL'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-4xl mb-3">👤</div>
          <h4 className="font-bold text-lg text-gray-800 mb-2">Личный аккаунт</h4>
          <p className="text-sm text-gray-600 mb-4">
            Для общения, публикаций и создания контента с друзьями
          </p>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✓ Близкие друзья</li>
            <li>✓ Индикаторы в stories</li>
            <li>✓ Личная лента</li>
            <li>✓ Прямые сообщения</li>
          </ul>
        </div>

        {/* Channel Account */}
        <div
          onClick={() => onChange('CHANNEL')}
          className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
            value === 'CHANNEL'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="text-4xl mb-3">📺</div>
          <h4 className="font-bold text-lg text-gray-800 mb-2">Канал</h4>
          <p className="text-sm text-gray-600 mb-4">
            Для контент-креаторов, медиа и брендов с большой аудиторией
          </p>
          <ul className="text-sm text-gray-700 space-y-2">
            <li>✓ Аналитика и статистика</li>
            <li>✓ Контроль комментариев</li>
            <li>✓ Верификация</li>
            <li>✓ Монетизация</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

/**
 * NotificationPreferences Component
 * Настройки уведомлений для подписки
 */
interface NotificationPreferencesProps {
  creatorName: string;
  onSave?: (preferences: NotificationSettings) => void;
  className?: string;
}

interface NotificationSettings {
  notifyOnPost: boolean;
  notifyOnStory: boolean;
  notifyOnLive: boolean;
  notifyOnClip: boolean;
  muteMinutes?: number;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  creatorName,
  onSave,
  className = '',
}) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    notifyOnPost: true,
    notifyOnStory: true,
    notifyOnLive: true,
    notifyOnClip: true,
  });
  const [muteOpen, setMuteOpen] = useState(false);

  const handleToggle = (key: keyof Omit<NotificationSettings, 'muteMinutes'>) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleMute = (minutes: number) => {
    setSettings(prev => ({
      ...prev,
      muteMinutes: minutes,
    }));
    setMuteOpen(false);
  };

  return (
    <div className={`bg-white border rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Уведомления от <span className="text-blue-600">{creatorName}</span>
      </h3>

      <div className="space-y-4">
        {/* Notification toggles */}
        <div className="space-y-3">
          {[
            { key: 'notifyOnPost', label: 'Новые посты', emoji: '📝' },
            { key: 'notifyOnStory', label: 'Stories', emoji: '📷' },
            { key: 'notifyOnLive', label: 'Прямые трансляции', emoji: '🔴' },
            { key: 'notifyOnClip', label: 'Клипы', emoji: '🎬' },
          ].map(({ key, label, emoji }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={settings[key as keyof Omit<NotificationSettings, 'muteMinutes'>]}
                  onChange={() => handleToggle(key as keyof Omit<NotificationSettings, 'muteMinutes'>)}
                  className="w-5 h-5 cursor-pointer"
                />
                <span className="text-lg">{emoji}</span>
                <span className="text-gray-800">{label}</span>
              </label>
            </div>
          ))}
        </div>

        {/* Mute option */}
        <div className="relative pt-4 border-t">
          <button
            onClick={() => setMuteOpen(!muteOpen)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            <Clock size={18} />
            <span>Заглушить уведомления на время</span>
          </button>

          {muteOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg z-10 min-w-max">
              {[15, 60, 480, 1440].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => handleMute(minutes)}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg border-b last:border-b-0"
                >
                  {minutes < 60
                    ? `${minutes} минут`
                    : minutes < 1440
                    ? `${Math.floor(minutes / 60)} часов`
                    : '1 день'}
                </button>
              ))}
              <button
                onClick={() => setMuteOpen(false)}
                className="block w-full text-left px-4 py-2 text-gray-500 text-sm border-t"
              >
                Отмена
              </button>
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={() => onSave?.(settings)}
          className="w-full mt-6 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};

/**
 * SubscriptionsList Component
 * Список подписок/подписчиков
 */
interface Subscriber {
  id: string;
  username: string;
  displayName: string;
  avatarFileId?: string;
  bio?: string;
  isFollowing?: boolean;
  isFriend?: boolean;
  subscriptionType?: 'VISIBLE' | 'SILENT';
}

interface SubscriptionsListProps {
  title: string;
  items: Subscriber[];
  isLoading?: boolean;
  onSubscriptionChange?: (userId: string, type: 'VISIBLE' | 'SILENT') => void;
  className?: string;
}

export const SubscriptionsList: React.FC<SubscriptionsListProps> = ({
  title,
  items,
  isLoading = false,
  onSubscriptionChange,
  className = '',
}) => {
  return (
    <div className={`bg-white border rounded-lg p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Список пуст</p>
      ) : (
        <div className="space-y-3">
          {items.map(subscriber => (
            <div key={subscriber.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3 flex-1">
                {subscriber.avatarFileId && (
                  <img
                    src={`/api/media/${subscriber.avatarFileId}`}
                    alt={subscriber.displayName}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <div className="font-medium text-gray-800">{subscriber.displayName}</div>
                  <div className="text-sm text-gray-500">@{subscriber.username}</div>
                </div>
              </div>
              
              {subscriber.subscriptionType && (
                <button
                  onClick={() => {
                    const newType = subscriber.subscriptionType === 'VISIBLE' ? 'SILENT' : 'VISIBLE';
                    onSubscriptionChange?.(subscriber.id, newType);
                  }}
                  title={subscriber.subscriptionType === 'VISIBLE' ? 'Заметная подписка' : 'Тихая подписка'}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {subscriber.subscriptionType === 'VISIBLE' ? (
                    <Bell size={18} className="text-blue-500" />
                  ) : (
                    <Bell size={18} className="text-gray-400 line-through" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default {
  SubscribeButton,
  AccountTypeSelector,
  NotificationPreferences,
  SubscriptionsList,
};
