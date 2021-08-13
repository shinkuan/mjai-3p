require "mjai/game"
require "mjai/action"
require "mjai/hora"
require "mjai/validation_error"


module Mjai
    
    class ActiveGame < Game
        
        ACTION_PREFERENCES = {
            :hora => 4,
            :ryukyoku => 3,
            :pon => 2,
            :daiminkan => 2,
            :chi => 1,
        }
        
        def initialize(players)
          super(players.shuffle())
          @game_type = :one_kyoku
        end
        
        attr_accessor(:game_type)
        
        def play()
          if ![:one_kyoku, :tonpu, :tonnan].include?(@game_type)
            raise("Unknown game_type")
          end
          begin
            do_action({:type => :start_game, :names => self.players.map(){ |pl| pl.name }})
            @ag_oya = @ag_chicha = @players[0]
            @ag_bakaze = Pai.new("E")
            @ag_honba = 0
            @ag_kyotaku = 0
            while !self.game_finished?
              play_kyoku()
            end
            do_action({:type => :end_game, :scores => get_final_scores()})
            return true
          rescue ValidationError => ex
            do_action({:type => :error, :message => ex.message})
            return false
          end
        end
        
        def play_kyoku()
          catch(:end_kyoku) do
            @pipais = @all_pais.shuffle()
            @pipais.shuffle!()
            @wanpais = @pipais.pop(14)
            dora_marker = @wanpais.pop()
            num_players = self.players.length
            tehais = Array.new(num_players){ @pipais.pop(13).sort() }
            do_action({
                :type => :start_kyoku,
                :bakaze => @ag_bakaze,
                :kyoku => (num_players + @ag_oya.id - @ag_chicha.id) % num_players + 1, # ここの剰余演算は不要? "@ag_oya.id + 1"でよいはず。
                :honba => @ag_honba,
                :kyotaku => @ag_kyotaku,
                :oya => @ag_oya,
                :dora_marker => dora_marker,
                :tehais => tehais,
            })
            @actor = self.oya
            while !@pipais.empty?
              mota()
              @actor = @players[(@actor.id + 1) % num_players]
            end
            process_fanpai()
          end
          do_action({:type => :end_kyoku})
        end
        
        # 摸打
        def mota()
          reach_pending = false
          kandora_pending = false
          tsumo_actor = @actor
          actions = [Action.new({:type => :tsumo, :actor => @actor, :pai => @pipais.pop()})]
          while !actions.empty?
            if actions[0].type == :hora
              if actions.size >= 3
                process_ryukyoku(:sanchaho, actions.map(){ |a| a.actor })
              else
                process_hora(actions)
              end
              throw(:end_kyoku)
            elsif actions[0].type == :ryukyoku
              raise("should not happen") if actions.size != 1
              process_ryukyoku(:kyushukyuhai, [actions[0].actor])
              throw(:end_kyoku)
            else
              raise("should not happen") if actions.size != 1
              action = actions[0]
              responses = do_action(action)
              next_actions = nil
              next_actions ||= choose_actions(responses)
              case action.type
                when :daiminkan, :kakan, :ankan
                  if action.type == :ankan
                    add_dora()
                  end
                  # Actually takes one from wanpai and moves one pai from pipai to wanpai,
                  # but it's equivalent to taking from pipai.
                  if next_actions.empty?
                    next_actions =
                      [Action.new({:type => :tsumo, :actor => action.actor, :pai => @pipais.pop()})]
                  else
                    raise("should not happen") if next_actions[0].type != :hora
                  end
                  # TODO Handle 4 kans.
                when :reach
                  reach_pending = true
              end
              if reach_pending &&
                  (next_actions.empty? || ![:dahai, :hora].include?(next_actions[0].type))
                @ag_kyotaku += 1
                deltas = Array.new(self.players.length, 0)
                deltas[tsumo_actor.id] = -1000
                do_action({
                    :type => :reach_accepted,
                    :actor => tsumo_actor,
                    :deltas => deltas,
                    :scores => get_scores(deltas),
                })
                reach_pending = false
              end
              if kandora_pending &&
                  !next_actions.empty? && [:dahai, :tsumo].include?(next_actions[0].type)
                add_dora()
                kandora_pending = false
              end
              if [:daiminkan, :kakan].include?(action.type) && ![:hora].include?(next_actions[0].type)
                kandora_pending = true
              end
              if action.type == :dahai && (next_actions.empty? || next_actions[0].type != :hora)
                check_ryukyoku()
              end
              actions = next_actions
            end
          end
        end
        
        def check_ryukyoku()
          if players.all?(){ |pl| pl.reach? }
            process_ryukyoku(:suchareach)
            throw(:end_kyoku)
          end
          if first_turn? && !players[0].sutehais.empty? && players[0].sutehais[0].fonpai? &&
              players.all?(){ |pl| pl.sutehais == [players[0].sutehais[0]] }
            process_ryukyoku(:sufonrenta)
            throw(:end_kyoku)
          end
          kan_counts = players.map(){ |pl| pl.furos.count(){ |f| f.kan? } }
          if kan_counts.inject(0){ |total, n| total + n } == 4 && !kan_counts.include?(4)
            process_ryukyoku(:sukaikan)
            throw(:end_kyoku)
          end
        end
        
        def update_state(action)
          super(action)
          if action.type == :tsumo && @pipais.size != self.num_pipais
            raise("num pipais mismatch: %p != %p" % [@pipais.size, self.num_pipais])
          end
        end
        
        def choose_actions(actions)
          actions = actions.select(){ |a| a }
          max_pref = actions.map(){ |a| ACTION_PREFERENCES[a.type] || 0 }.max
          max_actions = actions.select(){ |a| (ACTION_PREFERENCES[a.type] || 0) == max_pref }
          return max_actions
        end
        
        def process_hora(actions)
          tsumibo = self.honba
          ura = nil
          for action in actions.sort_by(){ |a| distance(a.actor, a.target) }
            if action.actor.reach? && !ura
              ura = @wanpais.pop(self.dora_markers.size)
            end
            uradora_markers = action.actor.reach? ? ura : []
            hora = get_hora(action, {
                :uradora_markers => uradora_markers,
                :previous_action => self.previous_action,
            })
            raise("no yaku") if !hora.valid?
            deltas = Array.new(self.players.length, 0)
            deltas[action.actor.id] += hora.points + tsumibo * 300 + @ag_kyotaku * 1000
            
            pao_id = action.actor.pao_for_id
            if hora.hora_type == :tsumo
              if pao_id != nil
                deltas[pao_id] -= (hora.points + tsumibo * 300)
              else
                for player in self.players
                  next if player == action.actor
                  deltas[player.id] -=
                      ((player == self.oya ? hora.oya_payment : hora.ko_payment) + tsumibo * 100)
                end
              end
            else
              if pao_id == action.target.id
                pao_id = nil
              end
              if pao_id != nil
                deltas[pao_id] -= (hora.points/2 + tsumibo * 300)
                deltas[action.target.id] -= (hora.points/2)
              else
                deltas[action.target.id] -= (hora.points + tsumibo * 300)
              end
            end
            do_action({
              :type => action.type,
              :actor => action.actor,
              :target => action.target,
              :pai => action.pai,
              :hora_tehais => action.actor.tehais,
              :uradora_markers => uradora_markers,
              :yakus => hora.yakus,
              :fu => hora.fu,
              :fan => hora.fan,
              :hora_points => hora.points,
              :deltas => deltas,
              :scores => get_scores(deltas),
            }.merge( pao_id!=nil ? {:pao=> self.players[pao_id]} : {} ) )
            # Only kamicha takes them in case of daburon.
            tsumibo = 0
            @ag_kyotaku = 0
          end
          update_oya(actions.any?(){ |a| a.actor == self.oya }, false)
        end
        
        def process_ryukyoku(reason, actors=[])
          actor = (reason == :kyushukyuhai) ? actors[0] : nil
          tenpais = []
          tehais = []
          for player in players
            if reason == :suchareach || actors.include?(player)  # :sanchaho, :kyushukyuhai
              tenpais.push(reason != :kyushukyuhai)
              tehais.push(player.tehais)
            else
              tenpais.push(false)
              tehais.push([Pai::UNKNOWN] * player.tehais.size)
            end
          end
          do_action({
              :type => :ryukyoku,
              :actor => actor,
              :reason => reason,
              :tenpais => tenpais,
              :tehais => tehais,
              :deltas => Array.new(self.players.length, 0),
              :scores => players.map(){ |player| player.score }
          })
          update_oya(true, reason)
        end
        
        def process_fanpai()
          tenpais = []
          tehais = []
          
          is_nagashi = false
          nagashi_deltas = Array.new(self.players.length, 0)
          
          for player in players
            #流し満貫の判定
            if player.sutehais.size == player.ho.size && #鳴かれておらず
             player.sutehais.all?{ |p| p.yaochu? }
              is_nagashi = true
              if player == self.oya
                nagashi_deltas = nagashi_deltas.map{|i| i - 4000}
                nagashi_deltas[player.id] += (4000 + (4000 * (self.players.length - 1)))
              else
                nagashi_deltas = nagashi_deltas.map{|i| i - 2000}
                nagashi_deltas[player.id] += (2000 + (4000 * (self.players.length)))
                nagashi_deltas[self.oya.id] -= 2000
              end
            end
            
            if player.tenpai?
              tenpais.push(true)
              tehais.push(player.tehais)
            else
              tenpais.push(false)
              tehais.push([Pai::UNKNOWN] * player.tehais.size)
            end
          end
          tenpai_ids = (0...tenpais.length).select(){ |i| tenpais[i] }
          noten_ids = (0...tenpais.length).select(){ |i| !tenpais[i] }
          
          if is_nagashi
            deltas = nagashi_deltas
          else
            deltas = Array.new(self.players.length, 0)
            if (1..3).include?(tenpai_ids.size)
              for id in tenpai_ids
                deltas[id] += 3000 / tenpai_ids.size
              end
              for id in noten_ids
                deltas[id] -= 3000 / noten_ids.size
              end
            end
          end
          
          reason = is_nagashi ? :nagashimangan : :fanpai
          do_action({
              :type => :ryukyoku,
              :reason => reason,
              :tenpais => tenpais,
              :tehais => tehais,
              :deltas => deltas,
              :scores => get_scores(deltas),
          })
          update_oya(tenpais[self.oya.id], reason)
        end
        
        def update_oya(renchan, ryukyoku_reason)
          if renchan
            @ag_oya = self.oya
          else
            @ag_oya = @players[(self.oya.id + 1) % @players.length]
            @ag_bakaze = @ag_bakaze.succ if @ag_oya == @players[0]
          end
          if renchan || ryukyoku_reason
            @ag_honba += 1
          else
            @ag_honba = 0
          end
          case @game_type
            when :tonpu
              @last = decide_last(Pai.new("E"), renchan, ryukyoku_reason)
            when :tonnan
              @last = decide_last(Pai.new("S"), renchan, ryukyoku_reason)
          end
        end
        
        def decide_last(last_bakaze, renchan, ryukyoku_reason)
          if @players.any? { |pl| pl.score < 0 }
            return true
          end

          if @ag_bakaze == last_bakaze.succ.succ
            return true
          end
          
          if ryukyoku_reason && ![:fanpai, :nagashimangan].include?(ryukyoku_reason)
            return false
          end
          
          if renchan
            if (@ag_bakaze == last_bakaze.succ) || (@ag_bakaze == last_bakaze && @ag_oya == @players[-1]) #オーラス
              return @ag_oya.score >= 30000 &&
                (0...@players.length).all? { |i| @ag_oya.id == i || @ag_oya.score > @players[i].score }
            end
          else
            if @ag_bakaze == last_bakaze.succ #オーラス
              return @players.any? { |pl| pl.score >= 30000 }
            end
          end

          return false
        end
        
        def add_dora()
          dora_marker = @wanpais.pop()
          do_action({:type => :dora, :dora_marker => dora_marker})
        end
        
        def game_finished?
          if @last
            return true
          else
            @last = true if @game_type == :one_kyoku
            return false
          end
        end
        
        def get_final_scores()
          # The winner takes remaining kyotaku.
          deltas = Array.new(self.players.length, 0)
          deltas[self.ranked_players[0].id] = @ag_kyotaku * 1000
          return get_scores(deltas)
        end
        
        def expect_response_from?(player)
          return true
        end
        
        def get_scores(deltas)
          return (0...self.players.length).map(){ |i| self.players[i].score + deltas[i] }
        end
        
    end
    
end
